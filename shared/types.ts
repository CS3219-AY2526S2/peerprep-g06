export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export interface Question {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  topic: string;
}

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  commonTopic: string;
  question: Question;
  difficulty: Difficulty;
  commonLanguage: string;
  createdAt: Date;
  status: MatchStatus;
}

export enum MatchStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  TIMED_OUT = 'TIMED_OUT',
}

export interface MatchFoundPayload {
  matchId: string;
  question: Question;
  peerId: string;
  difficulty: Difficulty;
  topic: string;
  language: string;
}

export interface MatchFoundEvent {
  eventVersion: 1;
  matchId: string;
  user1Id: string;
  user2Id: string;
  difficulty: Difficulty;
  topic: string;
  language: string;
  question: Question;
  matchedAt: string;
}

export interface SessionReadyPayload {
  sessionId: string;
  userId: string;
  joinToken: string;
  gracePeriodMs: number;
  language: string;
  question: Question;
  websocketUrl: string;
}

export interface JoinTokenClaims {
  sessionId: string;
  userId: string;
  matchId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface CollaborationSocketServerToClientEvents {
  'session-ready': (payload: SessionReadyPayload) => void;
  'notification:error': (payload: { message: string }) => void;
}

export interface CollaborationSocketClientToServerEvents {
  'notification:register': (payload: { userId: string }) => void;
}

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

export interface CollaborationSessionSocketServerToClientEvents {
  'session:joined': (payload: SessionJoinedPayload) => void;
  'session:error': (payload: { message: string }) => void;
  'doc:sync': (payload: SessionDocumentSyncPayload) => void;
  'doc:update': (payload: SessionDocumentSyncPayload & { userId: string }) => void;
  'participant:status': (payload: ParticipantStatusPayload) => void;
  'session:ended': (payload: SessionEndedPayload) => void;
}

export interface CollaborationSessionSocketClientToServerEvents {
  'doc:update': (payload: SessionDocumentUpdatePayload) => void;
  'session:leave': () => void;
}
