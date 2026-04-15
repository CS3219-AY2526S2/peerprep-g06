import { describe, expect, it } from 'vitest';
import {
  getParticipantConnectedReason,
  getParticipantStatusSnapshotReason,
  isSessionComplete,
  resolveParticipantJoinFailureCode,
  shouldHandleUnexpectedDisconnect,
} from '../src/services/sessionLifecycle';
import { SessionParticipant, StoredJoinToken } from '../src/types/session';

const nowIso = '2026-04-16T00:00:00.000Z';

const baseParticipant: SessionParticipant = {
  userId: 'user-1',
  status: 'connected',
  socketId: 'socket-1',
};

const baseStoredJoinToken: StoredJoinToken = {
  tokenHash: 'hash:join-token',
  claims: {
    sessionId: 'session-1',
    userId: 'user-1',
    matchId: 'match-1',
    issuedAt: '2026-04-15T23:00:00.000Z',
    expiresAt: '2026-04-16T01:00:00.000Z',
  },
};

describe('sessionLifecycle', () => {
  it('marks a session complete only when all participants left', () => {
    expect(
      isSessionComplete([
        { userId: 'user-1', status: 'left' },
        { userId: 'user-2', status: 'left' },
      ]),
    ).toBe(true);
    expect(
      isSessionComplete([
        { userId: 'user-1', status: 'left' },
        { userId: 'user-2', status: 'connected' },
      ]),
    ).toBe(false);
    expect(isSessionComplete(null)).toBe(false);
  });

  it('only handles unexpected disconnects for the active socket', () => {
    expect(
      shouldHandleUnexpectedDisconnect({
        explicitLeave: false,
        superseded: false,
        participant: baseParticipant,
        socketId: 'socket-1',
      }),
    ).toBe(true);

    expect(
      shouldHandleUnexpectedDisconnect({
        explicitLeave: true,
        superseded: false,
        participant: baseParticipant,
        socketId: 'socket-1',
      }),
    ).toBe(false);

    expect(
      shouldHandleUnexpectedDisconnect({
        explicitLeave: false,
        superseded: false,
        participant: { ...baseParticipant, status: 'left' },
        socketId: 'socket-1',
      }),
    ).toBe(false);
  });

  it('returns the expected join failure codes', () => {
    const hashJoinToken = (token: string) => `hash:${token}`;

    expect(
      resolveParticipantJoinFailureCode({
        sessionId: 'session-1',
        userId: 'user-1',
        joinToken: 'join-token',
        nowIso,
        session: null,
        participants: null,
        storedJoinToken: null,
        hashJoinToken,
      }),
    ).toBe('SESSION_NOT_FOUND');

    expect(
      resolveParticipantJoinFailureCode({
        sessionId: 'session-1',
        userId: 'user-1',
        joinToken: 'join-token',
        nowIso,
        session: {
          sessionId: 'session-1',
          matchId: 'match-1',
          user1Id: 'user-1',
          user2Id: 'user-2',
          language: 'typescript',
          status: 'active',
          gracePeriodMs: 30000,
          createdAt: nowIso,
        },
        participants: [baseParticipant],
        storedJoinToken: null,
        hashJoinToken,
      }),
    ).toBe('SESSION_EXPIRED');

    expect(
      resolveParticipantJoinFailureCode({
        sessionId: 'session-1',
        userId: 'user-1',
        joinToken: 'join-token',
        nowIso,
        session: {
          sessionId: 'session-1',
          matchId: 'match-1',
          user1Id: 'user-1',
          user2Id: 'user-2',
          language: 'typescript',
          status: 'ended',
          gracePeriodMs: 30000,
          createdAt: nowIso,
        },
        participants: [baseParticipant],
        storedJoinToken: baseStoredJoinToken,
        hashJoinToken,
      }),
    ).toBe('SESSION_ENDED');

    expect(
      resolveParticipantJoinFailureCode({
        sessionId: 'session-1',
        userId: 'user-9',
        joinToken: 'join-token',
        nowIso,
        session: {
          sessionId: 'session-1',
          matchId: 'match-1',
          user1Id: 'user-1',
          user2Id: 'user-2',
          language: 'typescript',
          status: 'active',
          gracePeriodMs: 30000,
          createdAt: nowIso,
        },
        participants: [baseParticipant],
        storedJoinToken: baseStoredJoinToken,
        hashJoinToken,
      }),
    ).toBe('USER_NOT_IN_SESSION');

    expect(
      resolveParticipantJoinFailureCode({
        sessionId: 'session-1',
        userId: 'user-1',
        joinToken: 'wrong-token',
        nowIso,
        session: {
          sessionId: 'session-1',
          matchId: 'match-1',
          user1Id: 'user-1',
          user2Id: 'user-2',
          language: 'typescript',
          status: 'active',
          gracePeriodMs: 30000,
          createdAt: nowIso,
        },
        participants: [baseParticipant],
        storedJoinToken: baseStoredJoinToken,
        hashJoinToken,
      }),
    ).toBe('INVALID_SESSION_TOKEN');

    expect(
      resolveParticipantJoinFailureCode({
        sessionId: 'session-1',
        userId: 'user-1',
        joinToken: 'join-token',
        nowIso,
        session: {
          sessionId: 'session-1',
          matchId: 'match-1',
          user1Id: 'user-1',
          user2Id: 'user-2',
          language: 'typescript',
          status: 'active',
          gracePeriodMs: 30000,
          createdAt: nowIso,
        },
        participants: [baseParticipant],
        storedJoinToken: baseStoredJoinToken,
        hashJoinToken,
      }),
    ).toBeNull();
  });

  it('returns stable participant status reasons', () => {
    expect(getParticipantConnectedReason('connected')).toBe('joined');
    expect(getParticipantConnectedReason('disconnected')).toBe('reconnected');

    expect(
      getParticipantStatusSnapshotReason({
        userId: 'user-1',
        status: 'connected',
      }),
    ).toBe('joined');

    expect(
      getParticipantStatusSnapshotReason({
        userId: 'user-1',
        status: 'connected',
        connectedAt: '2026-04-15T00:00:00.000Z',
        disconnectedAt: '2026-04-15T00:05:00.000Z',
      }),
    ).toBe('reconnected');

    expect(
      getParticipantStatusSnapshotReason({
        userId: 'user-1',
        status: 'disconnected',
      }),
    ).toBe('temporarily-disconnected');

    expect(
      getParticipantStatusSnapshotReason({
        userId: 'user-1',
        status: 'left',
      }),
    ).toBe('left');
  });
});
