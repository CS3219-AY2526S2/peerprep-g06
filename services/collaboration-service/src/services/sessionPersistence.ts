import { createHash } from 'crypto';
import { config } from '../config/env';
import { redis } from '../config/redis';
import { QuestionSnapshot } from '../types/contracts';
import {
  CollaborationSession,
  GracePeriodRecord,
  PendingDeliveryRecord,
  PersistedSessionSeed,
  SessionDocumentSnapshot,
  SessionParticipant,
  StoredJoinToken,
} from '../types/session';

const MATCH_LOCK_TTL_SECONDS = 30;

function sessionTtlSeconds(): number {
  return Math.ceil(config.joinTokenTtlMs / 1000) + 300;
}

function deliveryTtlSeconds(record: PendingDeliveryRecord): number {
  const expiresAt = new Date(record.expiresAt).getTime();
  const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
  return Math.max(ttl, 1);
}

function graceTtlSeconds(record: GracePeriodRecord): number {
  const expiresAt = new Date(record.expiresAt).getTime();
  const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
  return Math.max(ttl, 1);
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  return JSON.parse(value) as T;
}

export const collabKeys = {
  matchSession: (matchId: string) => `collab:match:${matchId}:session`,
  matchLock: (matchId: string) => `collab:lock:match:${matchId}`,
  session: (sessionId: string) => `collab:session:${sessionId}`,
  participants: (sessionId: string) => `collab:session:${sessionId}:participants`,
  question: (sessionId: string) => `collab:session:${sessionId}:question`,
  document: (sessionId: string) => `collab:session:${sessionId}:doc`,
  joinToken: (sessionId: string, userId: string) => `collab:session:${sessionId}:token:${userId}`,
  graceTimer: (sessionId: string, userId: string) => `collab:session:${sessionId}:grace:${userId}`,
  pendingDelivery: (userId: string, sessionId: string) => `collab:user:${userId}:delivery:${sessionId}`,
  pendingDeliveryIndex: (userId: string) => `collab:user:${userId}:deliveries`,
} as const;

export function hashJoinToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function claimMatchSessionLock(matchId: string): Promise<boolean> {
  const result = await redis.set(collabKeys.matchLock(matchId), '1', {
    NX: true,
    EX: MATCH_LOCK_TTL_SECONDS,
  });

  return result === 'OK';
}

export async function releaseMatchSessionLock(matchId: string): Promise<void> {
  await redis.del(collabKeys.matchLock(matchId));
}

export async function getSessionIdByMatchId(matchId: string): Promise<string | null> {
  return redis.get(collabKeys.matchSession(matchId));
}

export async function persistSessionSeed(matchId: string, seed: PersistedSessionSeed): Promise<void> {
  const ttlSeconds = sessionTtlSeconds();
  const transaction = redis.multi();

  transaction.set(collabKeys.matchSession(matchId), seed.session.sessionId, {
    EX: ttlSeconds,
  });
  transaction.set(collabKeys.session(seed.session.sessionId), JSON.stringify(seed.session), {
    EX: ttlSeconds,
  });
  transaction.set(collabKeys.participants(seed.session.sessionId), JSON.stringify(seed.participants), {
    EX: ttlSeconds,
  });
  transaction.set(collabKeys.question(seed.session.sessionId), JSON.stringify(seed.question), {
    EX: ttlSeconds,
  });
  transaction.set(collabKeys.document(seed.session.sessionId), JSON.stringify(seed.document), {
    EX: ttlSeconds,
  });

  for (const joinToken of seed.joinTokens) {
    transaction.set(
      collabKeys.joinToken(seed.session.sessionId, joinToken.record.claims.userId),
      JSON.stringify(joinToken.record),
      { PX: config.joinTokenTtlMs },
    );
  }

  await transaction.exec();
}

export async function getSession(sessionId: string): Promise<CollaborationSession | null> {
  return parseJson<CollaborationSession>(await redis.get(collabKeys.session(sessionId)));
}

export async function getQuestionSnapshot(sessionId: string): Promise<QuestionSnapshot | null> {
  return parseJson<QuestionSnapshot>(await redis.get(collabKeys.question(sessionId)));
}

export async function getParticipants(sessionId: string): Promise<SessionParticipant[] | null> {
  return parseJson<SessionParticipant[]>(await redis.get(collabKeys.participants(sessionId)));
}

export async function saveParticipants(sessionId: string, participants: SessionParticipant[]): Promise<void> {
  await redis.set(collabKeys.participants(sessionId), JSON.stringify(participants), {
    EX: sessionTtlSeconds(),
  });
}

export async function updateParticipantPresence(
  sessionId: string,
  userId: string,
  update: Partial<SessionParticipant>,
): Promise<SessionParticipant | null> {
  const participants = await getParticipants(sessionId);
  if (!participants) {
    return null;
  }

  const updatedParticipants = participants.map((participant) =>
    participant.userId === userId ? { ...participant, ...update } : participant,
  );

  await saveParticipants(sessionId, updatedParticipants);
  return updatedParticipants.find((participant) => participant.userId === userId) ?? null;
}

export async function getStoredJoinToken(
  sessionId: string,
  userId: string,
): Promise<StoredJoinToken | null> {
  return parseJson<StoredJoinToken>(await redis.get(collabKeys.joinToken(sessionId, userId)));
}

export async function saveDocumentSnapshot(snapshot: SessionDocumentSnapshot): Promise<void> {
  await redis.set(collabKeys.document(snapshot.sessionId), JSON.stringify(snapshot), {
    EX: sessionTtlSeconds(),
  });
}

export async function getDocumentSnapshot(sessionId: string): Promise<SessionDocumentSnapshot | null> {
  return parseJson<SessionDocumentSnapshot>(await redis.get(collabKeys.document(sessionId)));
}

export async function savePendingDelivery(record: PendingDeliveryRecord): Promise<void> {
  const ttlSeconds = deliveryTtlSeconds(record);
  const transaction = redis.multi();

  transaction.set(collabKeys.pendingDelivery(record.userId, record.sessionId), JSON.stringify(record), {
    EX: ttlSeconds,
  });
  transaction.sAdd(collabKeys.pendingDeliveryIndex(record.userId), record.sessionId);
  transaction.expire(collabKeys.pendingDeliveryIndex(record.userId), ttlSeconds);

  await transaction.exec();
}

export async function getPendingDelivery(
  userId: string,
  sessionId: string,
): Promise<PendingDeliveryRecord | null> {
  return parseJson<PendingDeliveryRecord>(await redis.get(collabKeys.pendingDelivery(userId, sessionId)));
}

export async function clearPendingDelivery(userId: string, sessionId: string): Promise<void> {
  const transaction = redis.multi();
  transaction.del(collabKeys.pendingDelivery(userId, sessionId));
  transaction.sRem(collabKeys.pendingDeliveryIndex(userId), sessionId);
  await transaction.exec();
}

export async function listPendingDeliveries(userId: string): Promise<PendingDeliveryRecord[]> {
  const sessionIds = await redis.sMembers(collabKeys.pendingDeliveryIndex(userId));
  if (sessionIds.length === 0) {
    return [];
  }

  const deliveries = await Promise.all(sessionIds.map((sessionId) => getPendingDelivery(userId, sessionId)));
  const validDeliveries: PendingDeliveryRecord[] = [];

  for (let index = 0; index < sessionIds.length; index += 1) {
    const delivery = deliveries[index];
    const sessionId = sessionIds[index];

    if (delivery) {
      validDeliveries.push(delivery);
    } else {
      await redis.sRem(collabKeys.pendingDeliveryIndex(userId), sessionId);
    }
  }

  return validDeliveries;
}

export async function saveGracePeriod(record: GracePeriodRecord): Promise<void> {
  await redis.set(collabKeys.graceTimer(record.sessionId, record.userId), JSON.stringify(record), {
    EX: graceTtlSeconds(record),
  });
}

export async function getGracePeriod(
  sessionId: string,
  userId: string,
): Promise<GracePeriodRecord | null> {
  return parseJson<GracePeriodRecord>(await redis.get(collabKeys.graceTimer(sessionId, userId)));
}

export async function clearGracePeriod(sessionId: string, userId: string): Promise<void> {
  await redis.del(collabKeys.graceTimer(sessionId, userId));
}
