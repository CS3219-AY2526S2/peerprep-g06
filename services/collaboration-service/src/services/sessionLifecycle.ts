import { CollaborationSession, SessionParticipant, StoredJoinToken } from '../types/session';

export type SessionJoinFailureCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_ENDED'
  | 'USER_NOT_IN_SESSION'
  | 'INVALID_SESSION_TOKEN';

interface ResolveJoinFailureCodeParams {
  sessionId: string;
  userId: string;
  joinToken: string;
  nowIso: string;
  session: CollaborationSession | null;
  participants: SessionParticipant[] | null;
  storedJoinToken: StoredJoinToken | null;
  hashJoinToken: (token: string) => string;
}

interface ShouldHandleUnexpectedDisconnectParams {
  explicitLeave: boolean;
  superseded: boolean;
  participant: SessionParticipant | null | undefined;
  socketId: string;
}

export function isSessionComplete(
  participants: SessionParticipant[] | null | undefined,
): boolean {
  return Boolean(participants && participants.every((participant) => participant.status === 'left'));
}

export function shouldHandleUnexpectedDisconnect({
  explicitLeave,
  superseded,
  participant,
  socketId,
}: ShouldHandleUnexpectedDisconnectParams): boolean {
  if (explicitLeave || superseded || !participant) {
    return false;
  }

  if (participant.status === 'left') {
    return false;
  }

  return participant.socketId === socketId;
}

export function resolveParticipantJoinFailureCode({
  sessionId,
  userId,
  joinToken,
  nowIso,
  session,
  participants,
  storedJoinToken,
  hashJoinToken: hashToken,
}: ResolveJoinFailureCodeParams): SessionJoinFailureCode | null {
  if (!session || !participants) {
    return 'SESSION_NOT_FOUND';
  }

  if (!storedJoinToken) {
    return 'SESSION_EXPIRED';
  }

  if (session.status === 'ended') {
    return 'SESSION_ENDED';
  }

  const participant = participants.find((entry) => entry.userId === userId);
  if (!participant) {
    return 'USER_NOT_IN_SESSION';
  }

  if (participant.status === 'left') {
    return 'SESSION_EXPIRED';
  }

  if (storedJoinToken.claims.expiresAt <= nowIso) {
    return 'SESSION_EXPIRED';
  }

  if (
    storedJoinToken.claims.sessionId !== sessionId ||
    storedJoinToken.claims.userId !== userId ||
    hashToken(joinToken) !== storedJoinToken.tokenHash
  ) {
    return 'INVALID_SESSION_TOKEN';
  }

  return null;
}

export function getParticipantConnectedReason(
  previousStatus: SessionParticipant['status'] | undefined,
): 'joined' | 'reconnected' {
  return previousStatus === 'disconnected' ? 'reconnected' : 'joined';
}

export function getParticipantStatusSnapshotReason(
  participant: SessionParticipant,
): 'joined' | 'reconnected' | 'temporarily-disconnected' | 'left' {
  switch (participant.status) {
    case 'left':
      return 'left';
    case 'disconnected':
      return 'temporarily-disconnected';
    default:
      return participant.connectedAt && participant.disconnectedAt ? 'reconnected' : 'joined';
  }
}
