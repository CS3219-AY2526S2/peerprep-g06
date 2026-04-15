// Notification delivery helpers.
// This service builds session-ready payloads, stores them for replay, and emits them to connected users.
import { Server } from 'socket.io';
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
import {
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents,
  SessionReadyPayload,
} from '../../../../shared/types';
import { AuthenticatedNotificationSocket, NotificationSocketData } from './socketAuth';
import { logger } from '../utils/logger';

const USER_ROOM_PREFIX = 'user:';

export type NotificationServer = Server<
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents,
  Record<string, never>,
  NotificationSocketData
>;

function getUserRoom(userId: string): string {
  return `${USER_ROOM_PREFIX}${userId}`;
}

export function registerAuthenticatedNotificationSocket(
  socket: AuthenticatedNotificationSocket,
  userId: string,
): void {
  socket.join(getUserRoom(userId));
  logger.info(`Registered notification socket ${socket.id} for user ${userId}`);
}

export function isNotificationUserConnected(io: NotificationServer, userId: string): boolean {
  const room = io.sockets.adapter.rooms.get(getUserRoom(userId));
  return Boolean(room && room.size > 0);
}

export function emitSessionReady(
  io: NotificationServer,
  userId: string,
  payload: SessionReadyPayload,
): void {
  io.to(getUserRoom(userId)).emit('session-ready', payload);
}

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
  io: NotificationServer,
  userId: string,
): Promise<void> {
  // Replays any notifications that were queued while the user was offline.
  const pendingDeliveries = await listPendingDeliveries(userId);

  for (const delivery of pendingDeliveries) {
    emitSessionReady(io, userId, delivery.payload);
    await clearPendingDelivery(userId, delivery.sessionId);
    logger.info(
      `Delivered pending session-ready for user ${userId} and session ${delivery.sessionId}`,
    );
  }
}

export async function deliverSessionReadyIfConnected(
  io: NotificationServer,
  userId: string,
  sessionId: string,
): Promise<void> {
  // Fast path for users who are already sitting on the notification socket when the match is processed.
  if (!isNotificationUserConnected(io, userId)) {
    return;
  }

  const delivery = await getPendingDelivery(userId, sessionId);
  if (!delivery) {
    return;
  }

  emitSessionReady(io, userId, delivery.payload);
  await clearPendingDelivery(userId, sessionId);
  logger.info(`Delivered live session-ready for user ${userId} and session ${sessionId}`);
}
