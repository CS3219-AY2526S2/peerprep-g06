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

function getStarterCode(event: MatchFoundEvent): string {
  return event.question.starterCodeByLanguage[event.language] ?? '';
}

function createJoinToken(matchId: string, sessionId: string, userId: string, nowIso: string): JoinTokenRecord {
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
      content: getStarterCode(event),
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
  const existingSessionId = await getSessionIdByMatchId(event.matchId);
  if (existingSessionId) {
    return { sessionId: existingSessionId, created: false };
  }

  const lockAcquired = await claimMatchSessionLock(event.matchId);

  if (!lockAcquired) {
    const sessionId = await getSessionIdByMatchId(event.matchId);
    if (sessionId) {
      return { sessionId, created: false };
    }

    throw new Error(`Session creation already in progress for match ${event.matchId}`);
  }

  try {
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
