import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureNotificationNamespace } from '../src/services/notificationSocket';
import {
  createIoHarness,
  createSocketClient,
  waitForConnectError,
  waitForEvent,
} from './helpers/socket';

const {
  getSupabaseUser,
  clearPendingDelivery,
  getPendingDelivery,
  getQuestionSnapshot,
  getSession,
  getStoredJoinToken,
  listPendingDeliveries,
  savePendingDelivery,
} = vi.hoisted(() => ({
  getSupabaseUser: vi.fn(),
  clearPendingDelivery: vi.fn(),
  getPendingDelivery: vi.fn(),
  getQuestionSnapshot: vi.fn(),
  getSession: vi.fn(),
  getStoredJoinToken: vi.fn(),
  listPendingDeliveries: vi.fn(),
  savePendingDelivery: vi.fn(),
}));

vi.mock('../src/lib/supabase', () => ({
  getSupabaseUser,
}));

vi.mock('../src/services/sessionPersistence', () => ({
  clearPendingDelivery,
  getPendingDelivery,
  getQuestionSnapshot,
  getSession,
  getStoredJoinToken,
  listPendingDeliveries,
  savePendingDelivery,
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('notificationSocket integration', () => {
  const sockets: ReturnType<typeof createSocketClient>[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  it('rejects missing tokens', async () => {
    const harness = await createIoHarness();
    try {
      configureNotificationNamespace(harness.io.of('/notifications') as any);

      const socket = createSocketClient(`${harness.baseUrl}/notifications`, {
        autoConnect: true,
      });
      sockets.push(socket);

      const error = await waitForConnectError(socket);
      expect(error.message).toBe('Missing access token');
    } finally {
      await harness.close();
    }
  });

  it('registers the authenticated socket and replays pending notifications on connect', async () => {
    getSupabaseUser.mockResolvedValueOnce({ id: 'user-1' });
    listPendingDeliveries.mockResolvedValueOnce([
      {
        userId: 'user-1',
        sessionId: 'session-1',
        type: 'session-ready',
        payload: {
          sessionId: 'session-1',
          userId: 'user-1',
          joinToken: 'join-token',
          gracePeriodMs: 30000,
          language: 'typescript',
          question: {
            id: '7',
            title: 'Two Sum',
            description: 'desc',
            difficulty: 'easy',
            topic: 'arrays',
          },
          websocketUrl: 'ws://localhost:3004',
        },
        createdAt: '2026-04-16T00:00:00.000Z',
        expiresAt: '2026-04-16T00:05:00.000Z',
      },
    ]);

    const harness = await createIoHarness();
    try {
      configureNotificationNamespace(harness.io.of('/notifications') as any);

      const socket = createSocketClient(`${harness.baseUrl}/notifications`, {
        auth: { token: 'valid-token' },
        autoConnect: true,
      });
      sockets.push(socket);

      const payload = await waitForEvent(socket, 'session-ready');
      expect(payload).toEqual(
        expect.objectContaining({
          sessionId: 'session-1',
          userId: 'user-1',
        }),
      );
      expect(clearPendingDelivery).toHaveBeenCalledWith('user-1', 'session-1');
      expect(harness.io.of('/notifications').adapter.rooms.get('user:user-1')?.size).toBe(1);
    } finally {
      await harness.close();
    }
  });

  it('replays pending notifications again when the client explicitly registers', async () => {
    getSupabaseUser.mockResolvedValueOnce({ id: 'user-1' });
    listPendingDeliveries.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        userId: 'user-1',
        sessionId: 'session-2',
        type: 'session-ready',
        payload: {
          sessionId: 'session-2',
          userId: 'user-1',
          joinToken: 'join-token',
          gracePeriodMs: 30000,
          language: 'typescript',
          question: {
            id: '7',
            title: 'Two Sum',
            description: 'desc',
            difficulty: 'easy',
            topic: 'arrays',
          },
          websocketUrl: 'ws://localhost:3004',
        },
        createdAt: '2026-04-16T00:00:00.000Z',
        expiresAt: '2026-04-16T00:05:00.000Z',
      },
    ]);

    const harness = await createIoHarness();
    try {
      configureNotificationNamespace(harness.io.of('/notifications') as any);

      const socket = createSocketClient(`${harness.baseUrl}/notifications`, {
        auth: { token: 'valid-token' },
        autoConnect: true,
      });
      sockets.push(socket);

      await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
      const pendingPayloadPromise = waitForEvent(socket, 'session-ready');
      socket.emit('notification:register', { userId: 'user-1' });

      await expect(pendingPayloadPromise).resolves.toEqual(
        expect.objectContaining({ sessionId: 'session-2' }),
      );
    } finally {
      await harness.close();
    }
  });
});
