import { createHash, randomBytes, randomUUID } from 'crypto';
import { config } from '../config/env';
import { redis } from '../config/redis';
import { JoinTokenClaims, MatchFoundEvent, QuestionSnapshot } from '../types/contracts';
import { CollaborationSession, SessionParticipant } from '../types/session';

const MATCH_LOCK_TTL_SECONDS = 30;

interface JoinTokenRecord {
  token: string;
  claims: JoinTokenClaims;
}

interface SessionSeed {
  session: CollaborationSession;
  participants: SessionParticipant[];
  question: QuestionSnapshot;
  document: {
    language: string;
    content: string;
    updatedAt: string;
  };
  joinTokens: JoinTokenRecord[];
}

function getMatchSessionKey(matchId: string): string {
  return `collab:match:${matchId}:session`;
}

function getMatchLockKey(matchId: string): string {
  return `collab:lock:match:${matchId}`;
}

function getSessionKey(sessionId: string): string {
  return `collab:session:${sessionId}`;
}

function getParticipantsKey(sessionId: string): string {
  return `collab:session:${sessionId}:participants`;
}

function getQuestionKey(sessionId: string): string {
  return `collab:session:${sessionId}:question`;
}

function getDocumentKey(sessionId: string): string {
  return `collab:session:${sessionId}:doc`;
}

function getJoinTokenKey(sessionId: string, userId: string): string {
  return `collab:session:${sessionId}:token:${userId}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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

function buildSessionSeed(event: MatchFoundEvent): SessionSeed {
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
      language: event.language,
      content: getStarterCode(event),
      updatedAt: createdAt,
    },
    joinTokens,
  };
}

export async function getSessionIdByMatchId(matchId: string): Promise<string | null> {
  return redis.get(getMatchSessionKey(matchId));
}

export async function createSessionFromMatchFound(event: MatchFoundEvent): Promise<{
  sessionId: string;
  created: boolean;
}> {
  const existingSessionId = await getSessionIdByMatchId(event.matchId);
  if (existingSessionId) {
    return { sessionId: existingSessionId, created: false };
  }

  const lockAcquired = await redis.set(getMatchLockKey(event.matchId), '1', {
    NX: true,
    EX: MATCH_LOCK_TTL_SECONDS,
  });

  if (lockAcquired !== 'OK') {
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
    const sessionTtlSeconds = Math.ceil(config.joinTokenTtlMs / 1000) + 300;
    const transaction = redis.multi();

    transaction.set(getMatchSessionKey(event.matchId), seed.session.sessionId, {
      EX: sessionTtlSeconds,
    });
    transaction.set(getSessionKey(seed.session.sessionId), JSON.stringify(seed.session), {
      EX: sessionTtlSeconds,
    });
    transaction.set(getParticipantsKey(seed.session.sessionId), JSON.stringify(seed.participants), {
      EX: sessionTtlSeconds,
    });
    transaction.set(getQuestionKey(seed.session.sessionId), JSON.stringify(seed.question), {
      EX: sessionTtlSeconds,
    });
    transaction.set(getDocumentKey(seed.session.sessionId), JSON.stringify(seed.document), {
      EX: sessionTtlSeconds,
    });

    for (const record of seed.joinTokens) {
      transaction.set(
        getJoinTokenKey(seed.session.sessionId, record.claims.userId),
        JSON.stringify({
          tokenHash: hashToken(record.token),
          claims: record.claims,
        }),
        {
          PX: config.joinTokenTtlMs,
        },
      );
    }

    await transaction.exec();

    return { sessionId: seed.session.sessionId, created: true };
  } finally {
    await redis.del(getMatchLockKey(event.matchId));
  }
}
