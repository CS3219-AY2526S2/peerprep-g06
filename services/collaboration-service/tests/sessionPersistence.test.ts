import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GracePeriodRecord, SessionParticipant } from '../src/types/session';

const redis = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  sMembers: vi.fn(),
  sRem: vi.fn(),
  multi: vi.fn(),
  zRangeByScore: vi.fn(),
  zRem: vi.fn(),
};

vi.mock('../src/config/redis', () => ({
  redis,
}));

describe('sessionPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the targeted participant presence without touching others', async () => {
    const participants: SessionParticipant[] = [
      { userId: 'user-1', status: 'connected', socketId: 'socket-1' },
      { userId: 'user-2', status: 'connected', socketId: 'socket-2' },
    ];

    redis.get.mockResolvedValueOnce(JSON.stringify(participants));
    redis.set.mockResolvedValueOnce('OK');

    const { updateParticipantPresence } = await import('../src/services/sessionPersistence');
    const updated = await updateParticipantPresence('session-1', 'user-1', {
      status: 'disconnected',
      socketId: undefined,
    });

    expect(updated).toEqual({
      userId: 'user-1',
      status: 'disconnected',
      socketId: undefined,
    });
    expect(redis.set).toHaveBeenCalledWith(
      'collab:session:session-1:participants',
      JSON.stringify([
        { userId: 'user-1', status: 'disconnected' },
        { userId: 'user-2', status: 'connected', socketId: 'socket-2' },
      ]),
      expect.objectContaining({ EX: expect.any(Number) }),
    );
  });

  it('writes grace periods into both the record key and the global sorted index', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const transaction = {
      set: vi.fn().mockReturnThis(),
      zAdd: vi.fn().mockReturnThis(),
      exec,
    };
    redis.multi.mockReturnValueOnce(transaction);

    const { saveGracePeriod } = await import('../src/services/sessionPersistence');
    const record: GracePeriodRecord = {
      sessionId: 'session-1',
      userId: 'user-1',
      createdAt: '2026-04-16T00:00:00.000Z',
      expiresAt: '2026-04-16T00:00:30.000Z',
    };

    await saveGracePeriod(record);

    expect(transaction.set).toHaveBeenCalledWith(
      'collab:session:session-1:grace:user-1',
      JSON.stringify(record),
      expect.objectContaining({ EX: expect.any(Number) }),
    );
    expect(transaction.zAdd).toHaveBeenCalledWith('collab:grace-periods', {
      score: new Date(record.expiresAt).getTime(),
      value: JSON.stringify({ sessionId: 'session-1', userId: 'user-1' }),
    });
    expect(exec).toHaveBeenCalled();
  });

  it('lists only valid grace periods and lazily clears stale index members', async () => {
    redis.zRangeByScore.mockResolvedValueOnce([
      JSON.stringify({ sessionId: 'session-1', userId: 'user-1' }),
      'not-json',
    ]);
    redis.get
      .mockResolvedValueOnce(
        JSON.stringify({
          sessionId: 'session-1',
          userId: 'user-1',
          createdAt: '2026-04-16T00:00:00.000Z',
          expiresAt: '2026-04-16T00:00:30.000Z',
        }),
      )
      .mockResolvedValueOnce(null);

    const { listGracePeriods } = await import('../src/services/sessionPersistence');
    const result = await listGracePeriods();

    expect(result).toEqual([
      {
        sessionId: 'session-1',
        userId: 'user-1',
        createdAt: '2026-04-16T00:00:00.000Z',
        expiresAt: '2026-04-16T00:00:30.000Z',
      },
    ]);
    expect(redis.zRem).toHaveBeenCalledWith('collab:grace-periods', 'not-json');
  });

  it('stores and clears pending delivery index entries atomically', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const transaction = {
      set: vi.fn().mockReturnThis(),
      sAdd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      sRem: vi.fn().mockReturnThis(),
      exec,
    };
    redis.multi.mockReturnValue(transaction);

    const { savePendingDelivery, clearPendingDelivery } =
      await import('../src/services/sessionPersistence');

    await savePendingDelivery({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'session-ready',
      payload: {
        sessionId: 'session-1',
        userId: 'user-1',
        joinToken: 'token',
        gracePeriodMs: 30000,
        language: 'typescript',
        question: {
          id: '1',
          title: 'Two Sum',
          description: 'desc',
          difficulty: 'easy',
          topic: 'arrays',
        },
        websocketUrl: 'ws://localhost:3004',
      },
      createdAt: '2026-04-16T00:00:00.000Z',
      expiresAt: '2026-04-16T00:00:30.000Z',
    });

    expect(transaction.set).toHaveBeenCalledWith(
      'collab:user:user-1:delivery:session-1',
      expect.any(String),
      expect.objectContaining({ EX: expect.any(Number) }),
    );
    expect(transaction.sAdd).toHaveBeenCalledWith('collab:user:user-1:deliveries', 'session-1');
    expect(transaction.expire).toHaveBeenCalledWith(
      'collab:user:user-1:deliveries',
      expect.any(Number),
    );

    await clearPendingDelivery('user-1', 'session-1');
    expect(transaction.del).toHaveBeenCalledWith('collab:user:user-1:delivery:session-1');
    expect(transaction.sRem).toHaveBeenCalledWith('collab:user:user-1:deliveries', 'session-1');
  });
});
