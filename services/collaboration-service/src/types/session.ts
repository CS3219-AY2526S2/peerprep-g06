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
