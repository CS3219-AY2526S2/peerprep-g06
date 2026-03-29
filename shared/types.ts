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
