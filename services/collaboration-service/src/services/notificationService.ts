// Notification delivery helpers.
// This service builds session-ready payloads, stores them for replay, and emits them to connected users.
import { config } from '../config/env';
import {
  clearPendingDelivery,
  getPendingDelivery,
  getQuestionSnapshot,
  getSession,
  getStoredJoinToken,
  listPendingDeliveries,
  savePendingDelivery,
} from './sessionPersistence';
import { SessionReadyPayload } from '../types/contracts';
import { NotificationTransport } from './realtimeTransport';
import { logger } from '../utils/logger';

function buildDeliveryExpiry(): string {
  return new Date(Date.now() + config.joinTokenTtlMs).toISOString();
}

export async function createSessionReadyPayload(
  sessionId: string,
  userId: string,
): Promise<SessionReadyPayload | null> {
  // A session-ready payload is assembled from the persisted session, question, and per-user join token.
  const [session, question, tokenRecord] = await Promise.all([
    getSession(sessionId),
    getQuestionSnapshot(sessionId),
    getStoredJoinToken(sessionId, userId),
  ]);

  if (!session || !question || !tokenRecord?.token) {
    return null;
  }

  return {
    sessionId,
    userId,
    joinToken: tokenRecord.token,
    gracePeriodMs: session.gracePeriodMs,
    language: session.language,
    question,
    websocketUrl: config.publicWebsocketUrl,
  };
}

export async function queueSessionReadyNotification(payload: SessionReadyPayload): Promise<void> {
  // Delivery is queued first so reconnect/retry paths do not depend on the user already being online.
  await savePendingDelivery({
    userId: payload.userId,
    sessionId: payload.sessionId,
    type: 'session-ready',
    payload,
    createdAt: new Date().toISOString(),
    expiresAt: buildDeliveryExpiry(),
  });
  logger.info(`Queued session-ready for user ${payload.userId} and session ${payload.sessionId}`);
}

export async function deliverPendingNotifications(
  transport: NotificationTransport,
  userId: string,
): Promise<void> {
  // Replays any notifications that were queued while the user was offline.
  const pendingDeliveries = await listPendingDeliveries(userId);

  for (const delivery of pendingDeliveries) {
    transport.emitSessionReady(userId, delivery.payload);
    await clearPendingDelivery(userId, delivery.sessionId);
    logger.info(
      `Delivered pending session-ready for user ${userId} and session ${delivery.sessionId}`,
    );
  }
}

export async function deliverSessionReadyIfConnected(
  transport: NotificationTransport,
  userId: string,
  sessionId: string,
): Promise<void> {
  // Fast path for users who are already sitting on the notification socket when the match is processed.
  if (!transport.isUserConnected(userId)) {
    return;
  }

  const delivery = await getPendingDelivery(userId, sessionId);
  if (!delivery) {
    return;
  }

  transport.emitSessionReady(userId, delivery.payload);
  await clearPendingDelivery(userId, sessionId);
  logger.info(`Delivered live session-ready for user ${userId} and session ${sessionId}`);
}
