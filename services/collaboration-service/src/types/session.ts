// Internal collaboration-service domain models.
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
  // Core session record created from a match and used as the anchor for all other persisted collaboration data.
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
  // The raw token is kept for session-ready delivery; the hash is the value used for later verification.
  token?: string;
  tokenHash: string;
  claims: JoinTokenClaims;
}

export interface SessionDocumentSnapshot {
  // This starts as plain starter code and later migrates to persisted Yjs document state.
  sessionId: string;
  language: string;
  content: string;
  format: 'plain-text' | 'yjs-update-base64';
  updatedAt: string;
}

export interface PendingDeliveryRecord {
  // Offline-safe notification record for queue-stage events such as session-ready.
  userId: string;
  sessionId: string;
  type: 'session-ready';
  payload: SessionReadyPayload;
  createdAt: string;
  expiresAt: string;
}

export interface GracePeriodRecord {
  // Reconnect grace-period state is stored separately so disconnect handling can be made idempotent later.
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface PersistedSessionSeed {
  // All records that are written together when a new collaboration session is created.
  session: CollaborationSession;
  participants: SessionParticipant[];
  question: QuestionSnapshot;
  document: SessionDocumentSnapshot;
  joinTokens: Array<{
    token: string;
    record: StoredJoinToken;
  }>;
}
