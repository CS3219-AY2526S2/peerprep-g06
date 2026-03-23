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

export interface SessionReadyPayload {
  sessionId: string;
  userId: string;
  joinToken: string;
  gracePeriodMs: number;
  language: string;
  question: QuestionSnapshot;
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
