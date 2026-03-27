// Session creation orchestration.
// This module turns a MatchFound event into the initial session seed that gets persisted in Redis.
import { randomBytes, randomUUID } from 'crypto';
import { config } from '../config/env';
import { JoinTokenClaims, MatchFoundEvent } from '../types/contracts';
import { CollaborationSession, PersistedSessionSeed, SessionParticipant } from '../types/session';
import {
  claimMatchSessionLock,
  getSessionIdByMatchId,
  hashJoinToken,
  persistSessionSeed,
  releaseMatchSessionLock,
} from './sessionPersistence';

interface JoinTokenRecord {
  token: string;
  claims: JoinTokenClaims;
}

function createJoinToken(matchId: string, sessionId: string, userId: string, nowIso: string): JoinTokenRecord {
  // Join tokens are generated here, then their verification record is stored in Redis.
  const token = randomBytes(32).toString('base64url');
  const claims: JoinTokenClaims = {
    sessionId,
    userId,
    matchId,
    issuedAt: nowIso,
    expiresAt: new Date(Date.now() + config.joinTokenTtlMs).toISOString(),
  };

  return { token, claims };
}

function buildSessionSeed(event: MatchFoundEvent): PersistedSessionSeed {
  // The seed is the full "first write" for a collaboration session:
  // metadata, participants, question, initial document, and per-user join tokens.
  const createdAt = new Date().toISOString();
  const sessionId = randomUUID();
  const session: CollaborationSession = {
    sessionId,
    matchId: event.matchId,
    user1Id: event.user1Id,
    user2Id: event.user2Id,
    language: event.language,
    status: 'pending',
    gracePeriodMs: config.gracePeriodMs,
    createdAt,
  };

  const participants: SessionParticipant[] = [event.user1Id, event.user2Id].map((userId) => ({
    userId,
    status: 'disconnected',
  }));

  const joinTokens = [
    createJoinToken(event.matchId, sessionId, event.user1Id, createdAt),
    createJoinToken(event.matchId, sessionId, event.user2Id, createdAt),
  ];

  return {
    session,
    participants,
    question: event.question,
    document: {
      sessionId,
      language: event.language,
      content: '',
      format: 'plain-text',
      updatedAt: createdAt,
    },
    joinTokens: joinTokens.map((joinToken) => ({
      token: joinToken.token,
      record: {
        token: joinToken.token,
        tokenHash: hashJoinToken(joinToken.token),
        claims: joinToken.claims,
      },
    })),
  };
}

export async function createSessionFromMatchFound(event: MatchFoundEvent): Promise<{
  sessionId: string;
  created: boolean;
}> {
  // First check is the fast idempotency path for redelivered MatchFound messages.
  const existingSessionId = await getSessionIdByMatchId(event.matchId);
  if (existingSessionId) {
    return { sessionId: existingSessionId, created: false };
  }

  const lockAcquired = await claimMatchSessionLock(event.matchId);

  if (!lockAcquired) {
    // Another worker may already be creating the same session under the match-level lock.
    const sessionId = await getSessionIdByMatchId(event.matchId);
    if (sessionId) {
      return { sessionId, created: false };
    }

    throw new Error(`Session creation already in progress for match ${event.matchId}`);
  }

  try {
    // Recheck after the lock in case another consumer finished before we entered the critical section.
    const recheckedSessionId = await getSessionIdByMatchId(event.matchId);
    if (recheckedSessionId) {
      return { sessionId: recheckedSessionId, created: false };
    }

    const seed = buildSessionSeed(event);
    await persistSessionSeed(event.matchId, seed);

    return { sessionId: seed.session.sessionId, created: true };
  } finally {
    await releaseMatchSessionLock(event.matchId);
  }
}
