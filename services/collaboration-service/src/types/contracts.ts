// Shared contract shapes used inside collaboration-service.
// These mirror the cross-service payloads that matching/gateway/frontend are expected to understand.
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionImage {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface QuestionSnapshot {
  questionId: string;
  version: number;
  title: string;
  description: string;
  examples: string[];
  constraints: string[];
  images: QuestionImage[];
  starterCodeByLanguage: Record<string, string>;
}

export interface MatchFoundEvent {
  // This is the event collaboration-service consumes from RabbitMQ when matching has found a pair.
  eventVersion: 1;
  matchId: string;
  user1Id: string;
  user2Id: string;
  difficulty: Difficulty;
  topic: string;
  language: string;
  question: QuestionSnapshot;
  matchedAt: string;
}

export interface JoinTokenClaims {
  sessionId: string;
  userId: string;
  matchId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SessionReadyPayload {
  // This is the payload eventually pushed to each matched user before they enter the live session room.
  sessionId: string;
  userId: string;
  joinToken: string;
  gracePeriodMs: number;
  language: string;
  question: QuestionSnapshot;
  websocketUrl: string;
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

export interface CollaborationSessionSocketServerToClientEvents {
  'session:joined': (payload: SessionJoinedPayload) => void;
  'session:error': (payload: { message: string }) => void;
}

export interface CollaborationSessionSocketClientToServerEvents {}
