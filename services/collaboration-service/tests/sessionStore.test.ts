import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Difficulty } from '../../../shared/types';

const claimMatchSessionLock = vi.fn();
const getSessionIdByMatchId = vi.fn();
const persistSessionSeed = vi.fn();
const releaseMatchSessionLock = vi.fn();

vi.mock('../src/services/sessionPersistence', () => ({
  claimMatchSessionLock,
  getSessionIdByMatchId,
  persistSessionSeed,
  releaseMatchSessionLock,
  hashJoinToken: vi.fn((token: string) => `hash:${token}`),
}));

vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => Buffer.from('seed-seed-seed-seed-seed-seed-seed-seed')),
  randomUUID: vi.fn(() => 'session-123'),
}));

describe('sessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the initial persisted session seed', async () => {
    const { buildSessionSeed } = await import('../src/services/sessionStore');

    const seed = buildSessionSeed({
      eventVersion: 1,
      matchId: 'match-1',
      user1Id: 'user-1',
      user2Id: 'user-2',
      difficulty: Difficulty.EASY,
      topic: 'arrays',
      language: 'typescript',
      matchedAt: '2026-04-16T00:00:00.000Z',
      question: {
        id: '7',
        title: 'Two Sum',
        description: 'desc',
        difficulty: 'easy',
        topic: 'arrays',
      },
    });

    expect(seed.session.sessionId).toBe('session-123');
    expect(seed.participants).toEqual([
      { userId: 'user-1', status: 'disconnected' },
      { userId: 'user-2', status: 'disconnected' },
    ]);
    expect(seed.joinTokens).toHaveLength(2);
    expect(seed.joinTokens[0].record.tokenHash).toBe(`hash:${seed.joinTokens[0].token}`);
    expect(seed.document.format).toBe('plain-text');
  });

  it('returns an existing session id without acquiring the lock', async () => {
    getSessionIdByMatchId.mockResolvedValueOnce('session-existing');
    const { createSessionFromMatchFound } = await import('../src/services/sessionStore');

    await expect(
      createSessionFromMatchFound({
        eventVersion: 1,
        matchId: 'match-1',
        user1Id: 'user-1',
        user2Id: 'user-2',
        difficulty: Difficulty.EASY,
        topic: 'arrays',
        language: 'typescript',
        matchedAt: '2026-04-16T00:00:00.000Z',
        question: {
          id: '7',
          title: 'Two Sum',
          description: 'desc',
          difficulty: 'easy',
          topic: 'arrays',
        },
      }),
    ).resolves.toEqual({ sessionId: 'session-existing', created: false });

    expect(claimMatchSessionLock).not.toHaveBeenCalled();
  });

  it('persists a new session when the lock is acquired', async () => {
    getSessionIdByMatchId.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    claimMatchSessionLock.mockResolvedValueOnce(true);
    const { createSessionFromMatchFound } = await import('../src/services/sessionStore');

    await expect(
      createSessionFromMatchFound({
        eventVersion: 1,
        matchId: 'match-1',
        user1Id: 'user-1',
        user2Id: 'user-2',
        difficulty: Difficulty.EASY,
        topic: 'arrays',
        language: 'typescript',
        matchedAt: '2026-04-16T00:00:00.000Z',
        question: {
          id: '7',
          title: 'Two Sum',
          description: 'desc',
          difficulty: 'easy',
          topic: 'arrays',
        },
      }),
    ).resolves.toEqual({ sessionId: 'session-123', created: true });

    expect(persistSessionSeed).toHaveBeenCalledWith(
      'match-1',
      expect.objectContaining({
        session: expect.objectContaining({ sessionId: 'session-123' }),
      }),
    );
    expect(releaseMatchSessionLock).toHaveBeenCalledWith('match-1');
  });

  it('throws when another worker holds the lock and the session is still absent', async () => {
    getSessionIdByMatchId.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    claimMatchSessionLock.mockResolvedValueOnce(false);
    const { createSessionFromMatchFound } = await import('../src/services/sessionStore');

    await expect(
      createSessionFromMatchFound({
        eventVersion: 1,
        matchId: 'match-1',
        user1Id: 'user-1',
        user2Id: 'user-2',
        difficulty: Difficulty.EASY,
        topic: 'arrays',
        language: 'typescript',
        matchedAt: '2026-04-16T00:00:00.000Z',
        question: {
          id: '7',
          title: 'Two Sum',
          description: 'desc',
          difficulty: 'easy',
          topic: 'arrays',
        },
      }),
    ).rejects.toThrow('Session creation already in progress for match match-1');
  });
});
