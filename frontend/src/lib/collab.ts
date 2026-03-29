import { io, Socket } from 'socket.io-client';
import { supabase } from '@/lib/supabase';
import { SessionReadyPayload } from '../../../shared/types';

const COLLAB_WS_URL = import.meta.env.VITE_COLLAB_WS_URL || 'http://localhost:3004';

export interface SessionJoinedPayload {
  sessionId: string;
  userId: string;
  participantIds: string[];
  language: string;
  status: 'pending' | 'active' | 'ended';
}

export interface SessionDocumentSyncPayload {
  sessionId: string;
  language: string;
  update: string;
  updatedAt: string;
  format: 'yjs-update-base64';
}

export interface SessionDocumentUpdatePayload {
  update: string;
}

export interface ParticipantStatusPayload {
  sessionId: string;
  userId: string;
  status: 'connected' | 'disconnected' | 'left';
  reason: 'joined' | 'reconnected' | 'temporarily-disconnected' | 'left' | 'grace-expired';
  at: string;
}

export interface SessionEndedPayload {
  sessionId: string;
  reason: 'all-participants-left';
  endedAt: string;
}

export interface NotificationServerToClientEvents {
  'session-ready': (payload: SessionReadyPayload) => void;
  'notification:error': (payload: { message: string }) => void;
}

export interface NotificationClientToServerEvents {
  'notification:register': (payload: { userId: string }) => void;
}

export interface SessionServerToClientEvents {
  'session:joined': (payload: SessionJoinedPayload) => void;
  'session:error': (payload: { message: string }) => void;
  'doc:sync': (payload: SessionDocumentSyncPayload) => void;
  'doc:update': (payload: SessionDocumentSyncPayload & { userId: string }) => void;
  'participant:status': (payload: ParticipantStatusPayload) => void;
  'session:ended': (payload: SessionEndedPayload) => void;
}

export interface SessionClientToServerEvents {
  'doc:update': (payload: SessionDocumentUpdatePayload) => void;
  'session:leave': () => void;
}

export type NotificationSocket = Socket<
  NotificationServerToClientEvents,
  NotificationClientToServerEvents
>;

export type SessionSocket = Socket<SessionServerToClientEvents, SessionClientToServerEvents>;

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
