import { JoinTokenClaims, QuestionSnapshot, SessionReadyPayload } from './contracts';

export type ParticipantStatus = 'connected' | 'disconnected' | 'left';
export type CollaborationSessionStatus = 'pending' | 'active' | 'ended';

export interface SessionParticipant {
  userId: string;
  status: ParticipantStatus;
  socketId?: string;
  connectedAt?: string;
  disconnectedAt?: string;
}

export interface CollaborationSession {
  sessionId: string;
  matchId: string;
  user1Id: string;
  user2Id: string;
  language: string;
  status: CollaborationSessionStatus;
  gracePeriodMs: number;
  createdAt: string;
}

export interface StoredJoinToken {
  token?: string;
  tokenHash: string;
  claims: JoinTokenClaims;
}

export interface SessionDocumentSnapshot {
  sessionId: string;
  language: string;
  content: string;
  format: 'plain-text' | 'yjs-update-base64';
  updatedAt: string;
}

export interface PendingDeliveryRecord {
  userId: string;
  sessionId: string;
  type: 'session-ready';
  payload: SessionReadyPayload;
  createdAt: string;
  expiresAt: string;
}

export interface GracePeriodRecord {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface PersistedSessionSeed {
  session: CollaborationSession;
  participants: SessionParticipant[];
  question: QuestionSnapshot;
  document: SessionDocumentSnapshot;
  joinTokens: Array<{
    token: string;
    record: StoredJoinToken;
  }>;
}
