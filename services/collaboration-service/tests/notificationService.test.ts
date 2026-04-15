import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearPendingDelivery = vi.fn();
const getPendingDelivery = vi.fn();
const getQuestionSnapshot = vi.fn();
const getSession = vi.fn();
const getStoredJoinToken = vi.fn();
const listPendingDeliveries = vi.fn();
const savePendingDelivery = vi.fn();

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

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a session-ready payload from persisted session data', async () => {
    getSession.mockResolvedValueOnce({
      sessionId: 'session-1',
      matchId: 'match-1',
      user1Id: 'user-1',
      user2Id: 'user-2',
      language: 'typescript',
      status: 'pending',
      gracePeriodMs: 30000,
      createdAt: '2026-04-16T00:00:00.000Z',
    });
    getQuestionSnapshot.mockResolvedValueOnce({
      id: '7',
      title: 'Two Sum',
      description: 'desc',
      difficulty: 'easy',
      topic: 'arrays',
    });
    getStoredJoinToken.mockResolvedValueOnce({
      token: 'join-token',
      tokenHash: 'hash',
      claims: {
        sessionId: 'session-1',
        userId: 'user-1',
        matchId: 'match-1',
        issuedAt: '2026-04-16T00:00:00.000Z',
        expiresAt: '2026-04-16T00:05:00.000Z',
      },
    });

    const { createSessionReadyPayload } = await import('../src/services/notificationService');
    await expect(createSessionReadyPayload('session-1', 'user-1')).resolves.toEqual({
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
      websocketUrl: expect.any(String),
    });
  });

  it('returns null when any persisted prerequisite is missing', async () => {
    getSession.mockResolvedValueOnce(null);
    getQuestionSnapshot.mockResolvedValueOnce(null);
    getStoredJoinToken.mockResolvedValueOnce(null);

    const { createSessionReadyPayload } = await import('../src/services/notificationService');
    await expect(createSessionReadyPayload('session-1', 'user-1')).resolves.toBeNull();
  });

  it('queues session-ready notifications for replay', async () => {
    const { queueSessionReadyNotification } = await import('../src/services/notificationService');
    await queueSessionReadyNotification({
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
    });

    expect(savePendingDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        type: 'session-ready',
        payload: expect.objectContaining({ sessionId: 'session-1' }),
      }),
    );
  });

  it('replays pending notifications and clears them afterwards', async () => {
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

    const emit = vi.fn();
    const io = {
      to: vi.fn(() => ({ emit })),
    };

    const { deliverPendingNotifications } = await import('../src/services/notificationService');
    await deliverPendingNotifications(io as any, 'user-1');

    expect(io.to).toHaveBeenCalledWith('user:user-1');
    expect(emit).toHaveBeenCalledWith(
      'session-ready',
      expect.objectContaining({ sessionId: 'session-1' }),
    );
    expect(clearPendingDelivery).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('only delivers live notifications when the user room is connected', async () => {
    const emit = vi.fn();
    const io = {
      sockets: {
        adapter: {
          rooms: new Map([['user:user-1', new Set(['socket-1'])]]),
        },
      },
      to: vi.fn(() => ({ emit })),
    };
    getPendingDelivery.mockResolvedValueOnce({
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
    });

    const { deliverSessionReadyIfConnected } = await import('../src/services/notificationService');
    await deliverSessionReadyIfConnected(io as any, 'user-1', 'session-1');

    expect(emit).toHaveBeenCalledWith(
      'session-ready',
      expect.objectContaining({ sessionId: 'session-1' }),
    );
    expect(clearPendingDelivery).toHaveBeenCalledWith('user-1', 'session-1');
  });
});
