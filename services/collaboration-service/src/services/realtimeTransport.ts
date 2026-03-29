// Transport boundary for client-facing realtime delivery.
// Domain services depend on these interfaces so a future API gateway can front
// the same payloads without changing collaboration session logic.
import { Namespace, Server } from 'socket.io';
import {
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents,
  ParticipantStatusPayload,
  SessionDocumentSyncPayload,
  SessionEndedPayload,
  SessionReadyPayload,
} from '../types/contracts';
import { logger } from '../utils/logger';

const USER_ROOM_PREFIX = 'user:';
const SESSION_ROOM_PREFIX = 'session:';

export interface NotificationTransport {
  registerUserSocket(socket: any, userId: string): void;
  isUserConnected(userId: string): boolean;
  emitSessionReady(userId: string, payload: SessionReadyPayload): void;
}

export interface SessionTransport {
  joinSessionRoom(socket: any, sessionId: string): void;
  disconnectSocket(socketId?: string): void;
  emitDocumentSync(socket: any, payload: SessionDocumentSyncPayload): void;
  emitDocumentUpdateToPeers(
    sessionId: string,
    excludedSocketId: string,
    payload: SessionDocumentSyncPayload & { userId: string },
  ): void;
  emitParticipantStatus(
    sessionId: string,
    payload: ParticipantStatusPayload,
    excludedSocketId?: string,
  ): void;
  emitSessionEnded(sessionId: string, payload: SessionEndedPayload): void;
}

type NotificationNamespace = Server<
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents
>;

type SessionNamespace = Namespace<
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents
>;

function getUserRoom(userId: string): string {
  return `${USER_ROOM_PREFIX}${userId}`;
}

function getSessionRoom(sessionId: string): string {
  return `${SESSION_ROOM_PREFIX}${sessionId}`;
}

export function createSocketIoNotificationTransport(
  io: NotificationNamespace,
): NotificationTransport {
  return {
    registerUserSocket(socket: any, userId: string) {
      socket.join(getUserRoom(userId));
      logger.info(`Registered notification socket ${socket.id} for user ${userId}`);
    },
    isUserConnected(userId: string) {
      const room = io.sockets.adapter.rooms.get(getUserRoom(userId));
      return Boolean(room && room.size > 0);
    },
    emitSessionReady(userId: string, payload: SessionReadyPayload) {
      io.to(getUserRoom(userId)).emit('session-ready', payload);
    },
  };
}

export function createSocketIoSessionTransport(namespace: SessionNamespace): SessionTransport {
  return {
    joinSessionRoom(socket: any, sessionId: string) {
      socket.join(getSessionRoom(sessionId));
    },
    disconnectSocket(socketId?: string) {
      if (!socketId) {
        return;
      }

      const staleSocket = namespace.sockets.get(socketId);
      if (staleSocket) {
        staleSocket.disconnect(true);
      }
    },
    emitDocumentSync(socket: any, payload: SessionDocumentSyncPayload) {
      socket.emit('doc:sync', payload);
    },
    emitDocumentUpdateToPeers(sessionId: string, excludedSocketId: string, payload) {
      namespace.except(excludedSocketId).to(getSessionRoom(sessionId)).emit('doc:update', payload);
    },
    emitParticipantStatus(
      sessionId: string,
      payload: ParticipantStatusPayload,
      excludedSocketId?: string,
    ) {
      const room = getSessionRoom(sessionId);

      if (excludedSocketId) {
        namespace.except(excludedSocketId).to(room).emit('participant:status', payload);
        return;
      }

      namespace.to(room).emit('participant:status', payload);
    },
    emitSessionEnded(sessionId: string, payload: SessionEndedPayload) {
      namespace.to(getSessionRoom(sessionId)).emit('session:ended', payload);
    },
  };
}
