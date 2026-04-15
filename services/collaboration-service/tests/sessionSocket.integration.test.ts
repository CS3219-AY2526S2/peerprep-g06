import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { configureSessionNamespace } from '../src/services/sessionSocket';
import {
  createIoHarness,
  createSocketClient,
  waitForConnectError,
  waitForEvent,
} from './helpers/socket';
import { SessionParticipant, StoredJoinToken } from '../src/types/session';

const {
  getSupabaseUser,
  applyDocumentUpdate,
  clearGracePeriod,
  deleteSessionState,
  disposeDocument,
  flushDocumentSnapshot,
  getDocumentSyncPayload,
  getGracePeriod,
  getParticipants,
  getSession,
  getStoredJoinToken,
  listGracePeriods,
  persistSessionAttemptHistory,
  saveGracePeriod,
  updateParticipantPresence,
  updateSessionStatus,
} = vi.hoisted(() => ({
  getSupabaseUser: vi.fn(),
  applyDocumentUpdate: vi.fn(),
  clearGracePeriod: vi.fn(),
  deleteSessionState: vi.fn(),
  disposeDocument: vi.fn(),
  flushDocumentSnapshot: vi.fn(),
  getDocumentSyncPayload: vi.fn(),
  getGracePeriod: vi.fn(),
  getParticipants: vi.fn(),
  getSession: vi.fn(),
  getStoredJoinToken: vi.fn(),
  listGracePeriods: vi.fn(),
  persistSessionAttemptHistory: vi.fn(),
  saveGracePeriod: vi.fn(),
  updateParticipantPresence: vi.fn(),
  updateSessionStatus: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  getSupabaseUser,
}));

vi.mock('../src/services/documentSyncService', () => ({
  applyDocumentUpdate,
  disposeDocument,
  flushDocumentSnapshot,
  getDocumentSyncPayload,
}));

vi.mock('../src/services/attemptHistory', () => ({
  persistSessionAttemptHistory,
}));

vi.mock('../src/services/sessionPersistence', () => ({
  clearGracePeriod,
  deleteSessionState,
  getGracePeriod,
  getParticipants,
  getSession,
  getStoredJoinToken,
  hashJoinToken: vi.fn((token: string) => createHash('sha256').update(token).digest('hex')),
  listGracePeriods,
  saveGracePeriod,
  updateParticipantPresence,
  updateSessionStatus,
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('sessionSocket integration', () => {
  const sockets: ReturnType<typeof createSocketClient>[] = [];
  const session = {
    sessionId: 'session-1',
    matchId: 'match-1',
    user1Id: 'user-1',
    user2Id: 'user-2',
    language: 'typescript',
    status: 'pending' as const,
    gracePeriodMs: 30000,
    createdAt: '2026-04-16T00:00:00.000Z',
  };
  let participants: SessionParticipant[];
  let storedJoinTokens: Record<string, StoredJoinToken>;

  beforeEach(() => {
    vi.clearAllMocks();

    participants = [
      { userId: 'user-1', status: 'disconnected' },
      { userId: 'user-2', status: 'disconnected' },
    ];

    storedJoinTokens = {
      'user-1': {
        tokenHash: createHash('sha256').update('join-token-1').digest('hex'),
        claims: {
          sessionId: 'session-1',
          userId: 'user-1',
          matchId: 'match-1',
          issuedAt: '2026-04-16T00:00:00.000Z',
          expiresAt: '2026-04-16T01:00:00.000Z',
        },
      },
      'user-2': {
        tokenHash: createHash('sha256').update('join-token-2').digest('hex'),
        claims: {
          sessionId: 'session-1',
          userId: 'user-2',
          matchId: 'match-1',
          issuedAt: '2026-04-16T00:00:00.000Z',
          expiresAt: '2026-04-16T01:00:00.000Z',
        },
      },
    };

    getSupabaseUser.mockImplementation(async (token: string) => {
      if (token === 'access-token-1') return { id: 'user-1' };
      if (token === 'access-token-2') return { id: 'user-2' };
      return null;
    });

    getSession.mockImplementation(async () => session);
    getParticipants.mockImplementation(async () => participants);
    getStoredJoinToken.mockImplementation(async (_sessionId: string, userId: string) => {
      return storedJoinTokens[userId] ?? null;
    });
    updateParticipantPresence.mockImplementation(
      async (_sessionId: string, userId: string, update: Partial<SessionParticipant>) => {
        participants = participants.map((participant) =>
          participant.userId === userId ? { ...participant, ...update } : participant,
        );
        return participants.find((participant) => participant.userId === userId) ?? null;
      },
    );
    updateSessionStatus.mockImplementation(
      async (_sessionId: string, status: typeof session.status) => ({
        ...session,
        status,
      }),
    );
    clearGracePeriod.mockResolvedValue(undefined);
    saveGracePeriod.mockResolvedValue(undefined);
    getGracePeriod.mockResolvedValue(null);
    listGracePeriods.mockResolvedValue([]);
    getDocumentSyncPayload.mockResolvedValue({
      sessionId: 'session-1',
      language: 'typescript',
      update: 'initial-update',
      updatedAt: '2026-04-16T00:00:00.000Z',
      format: 'yjs-update-base64',
    });
    applyDocumentUpdate.mockResolvedValue({
      sessionId: 'session-1',
      language: 'typescript',
      update: 'peer-update',
      updatedAt: '2026-04-16T00:00:01.000Z',
      format: 'yjs-update-base64',
    });
    flushDocumentSnapshot.mockResolvedValue(undefined);
    persistSessionAttemptHistory.mockResolvedValue(undefined);
    disposeDocument.mockResolvedValue(undefined);
    deleteSessionState.mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  function connectSessionClient(baseUrl: string, userId: 'user-1' | 'user-2') {
    const socket = createSocketClient(`${baseUrl}/session`, {
      autoConnect: true,
      auth: {
        token: userId === 'user-1' ? 'access-token-1' : 'access-token-2',
        sessionId: 'session-1',
        joinToken: userId === 'user-1' ? 'join-token-1' : 'join-token-2',
      },
    });
    sockets.push(socket);
    return socket;
  }

  it('rejects invalid access tokens', async () => {
    const harness = await createIoHarness();
    try {
      configureSessionNamespace(harness.io.of('/session') as any);

      const socket = createSocketClient(`${harness.baseUrl}/session`, {
        autoConnect: true,
        auth: {
          token: 'bad-token',
          sessionId: 'session-1',
          joinToken: 'join-token-1',
        },
      });
      sockets.push(socket);

      const error = await waitForConnectError(socket);
      expect(error.message).toBe('INVALID_ACCESS_TOKEN');
    } finally {
      await harness.close();
    }
  });

  it('joins the session, sends the initial sync, relays doc updates, and broadcasts leave/end state', async () => {
    const harness = await createIoHarness();
    try {
      configureSessionNamespace(harness.io.of('/session') as any);

      const user1 = connectSessionClient(harness.baseUrl, 'user-1');
      const user2 = connectSessionClient(harness.baseUrl, 'user-2');
      const sync1Promise = waitForEvent(user1, 'doc:sync');
      const sync2Promise = waitForEvent(user2, 'doc:sync');

      const [join1, join2] = await Promise.all([
        waitForEvent(user1, 'session:joined'),
        waitForEvent(user2, 'session:joined'),
      ]);
      expect(join1).toEqual(
        expect.objectContaining({
          sessionId: 'session-1',
          userId: 'user-1',
          participantIds: ['user-1', 'user-2'],
        }),
      );
      expect(join2).toEqual(expect.objectContaining({ userId: 'user-2' }));

      await expect(sync1Promise).resolves.toEqual(
        expect.objectContaining({ update: 'initial-update' }),
      );
      await expect(sync2Promise).resolves.toEqual(
        expect.objectContaining({ update: 'initial-update' }),
      );

      const peerUpdatePromise = waitForEvent(user2, 'doc:update');
      user1.emit('doc:update', { update: 'local-update' });
      await expect(peerUpdatePromise).resolves.toEqual(
        expect.objectContaining({
          sessionId: 'session-1',
          userId: 'user-1',
          update: 'peer-update',
        }),
      );
      expect(applyDocumentUpdate).toHaveBeenCalledWith('session-1', 'local-update');

      const user1LeftPromise = waitForEvent(user2, 'participant:status');
      user1.emit('session:leave');
      await expect(user1LeftPromise).resolves.toEqual(
        expect.objectContaining({
          userId: 'user-1',
          status: 'left',
          reason: 'left',
        }),
      );

      const sessionEndedPromise = waitForEvent(user2, 'session:ended');
      user2.emit('session:leave');
      await expect(sessionEndedPromise).resolves.toEqual(
        expect.objectContaining({
          sessionId: 'session-1',
          reason: 'all-participants-left',
        }),
      );

      expect(flushDocumentSnapshot).toHaveBeenCalledWith('session-1');
      expect(persistSessionAttemptHistory).toHaveBeenCalledWith('session-1');
      expect(disposeDocument).toHaveBeenCalledWith('session-1');
      expect(deleteSessionState).toHaveBeenCalledWith('session-1');
    } finally {
      await harness.close();
    }
  });
});
