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

const COLLAB_WS_URL = import.meta.env.VITE_COLLAB_WS_URL || 'http://localhost:3004';

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
  return io(COLLAB_WS_URL, {
    transports: ['websocket'],
    auth: {
      token: accessToken,
    },
  });
}

export function createSessionSocket(
  accessToken: string,
  sessionId: string,
  joinToken: string,
): SessionSocket {
  return io(`${COLLAB_WS_URL}/session`, {
    transports: ['websocket'],
    auth: {
      token: accessToken,
      sessionId,
      joinToken,
    },
  });
}
