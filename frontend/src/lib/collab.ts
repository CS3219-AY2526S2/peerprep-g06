import { io, Socket } from 'socket.io-client';
import { supabase } from '@/lib/supabase';
import {
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents,
} from '../../../shared/types';
export type {
  ParticipantStatusPayload,
  SessionDocumentSyncPayload,
  SessionDocumentUpdatePayload,
  SessionEndedPayload,
  SessionJoinedPayload,
  SessionReadyPayload,
} from '../../../shared/types';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';
const COLLAB_WS_PATH = import.meta.env.VITE_COLLAB_WS_PATH || '/socket.io';

export type NotificationSocket = Socket<
  CollaborationSocketServerToClientEvents,
  CollaborationSocketClientToServerEvents
>;

export type SessionSocket = Socket<
  CollaborationSessionSocketServerToClientEvents,
  CollaborationSessionSocketClientToServerEvents
>;

export async function getCollabAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Missing Supabase access token');
  }

  return session.access_token;
}

export function createNotificationSocket(accessToken: string): NotificationSocket {
  return io(GATEWAY_URL, {
    transports: ['websocket'],
    path: COLLAB_WS_PATH,
    auth: {
      token: accessToken,
    },
  });
}

export function createSessionSocket(
  accessToken: string,
  sessionId: string,
  joinToken: string,
  reconnectAttempts: number,
): SessionSocket {
  return io(`${GATEWAY_URL}/session`, {
    transports: ['websocket'],
    path: COLLAB_WS_PATH,
    reconnection: true,
    reconnectionAttempts: reconnectAttempts,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 4000,
    timeout: 10000,
    auth: {
      token: accessToken,
      sessionId,
      joinToken,
    },
  });
}
