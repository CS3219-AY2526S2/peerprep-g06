import { Socket } from 'socket.io';
import {
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents,
} from '../../../../shared/types';
import { ParticipantStatus } from '../types/session';

export interface NotificationSocketData {
  userId?: string;
}

export interface SessionSocketData {
  userId?: string;
  sessionId?: string;
  previousStatus?: ParticipantStatus;
  explicitLeave?: boolean;
  leaveHandled?: boolean;
  superseded?: boolean;
}

export type AuthenticatedNotificationSocket = Socket<
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents,
  Record<string, never>,
  NotificationSocketData
>;

export type AuthenticatedSessionSocket = Socket<
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  Record<string, never>,
  SessionSocketData
>;

type BearerTokenSocket = {
  handshake: {
    auth?: {
      token?: unknown;
    };
    headers: {
      authorization?: unknown;
    };
  };
};

export function getBearerToken(socket: BearerTokenSocket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  return null;
}
