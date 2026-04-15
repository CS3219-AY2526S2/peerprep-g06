import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Difficulty } from '../../../shared/types';

const createSessionFromMatchFound = vi.fn();
const createSessionReadyPayload = vi.fn();
const deliverSessionReadyIfConnected = vi.fn();
const queueSessionReadyNotification = vi.fn();

vi.mock('../src/services/sessionStore', () => ({
  createSessionFromMatchFound,
}));

vi.mock('../src/services/notificationService', () => ({
  createSessionReadyPayload,
  deliverSessionReadyIfConnected,
  queueSessionReadyNotification,
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('matchFoundConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a valid match-found envelope', async () => {
    const { parseMatchFoundEvent } = await import('../src/services/matchFoundConsumer');

    const result = parseMatchFoundEvent(
      Buffer.from(
        JSON.stringify({
          event: 'match',
          data: {
            matchFound: {
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
            },
          },
        }),
      ),
    );

    expect(result.matchId).toBe('match-1');
  });

  it('rejects malformed envelopes', async () => {
    const { parseMatchFoundEvent } = await import('../src/services/matchFoundConsumer');

    expect(() => parseMatchFoundEvent(Buffer.from(JSON.stringify({ event: 'bad' })))).toThrow(
      'Invalid MatchFound payload',
    );
  });

  it('queues and delivers both session-ready payloads for a new session', async () => {
    const channel = {
      assertExchange: vi.fn(),
      assertQueue: vi.fn(),
      bindQueue: vi.fn(),
      prefetch: vi.fn(),
      consume: vi.fn(),
      ack: vi.fn(),
      nack: vi.fn(),
    };
    const notificationServer = {} as any;

    createSessionFromMatchFound.mockResolvedValueOnce({
      sessionId: 'session-1',
      created: true,
    });
    createSessionReadyPayload
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        userId: 'user-1',
        joinToken: 'token-1',
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
      })
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        userId: 'user-2',
        joinToken: 'token-2',
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

    const { startMatchFoundConsumer } = await import('../src/services/matchFoundConsumer');
    await startMatchFoundConsumer(channel as any, notificationServer);

    const consumeHandler = channel.consume.mock.calls[0][1];
    const message = {
      content: Buffer.from(
        JSON.stringify({
          event: 'match',
          data: {
            matchFound: {
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
            },
          },
        }),
      ),
    };

    await consumeHandler(message);

    expect(queueSessionReadyNotification).toHaveBeenCalledTimes(2);
    expect(deliverSessionReadyIfConnected).toHaveBeenCalledTimes(2);
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('skips queueing on already-created sessions but still tries live delivery', async () => {
    const channel = {
      assertExchange: vi.fn(),
      assertQueue: vi.fn(),
      bindQueue: vi.fn(),
      prefetch: vi.fn(),
      consume: vi.fn(),
      ack: vi.fn(),
      nack: vi.fn(),
    };

    createSessionFromMatchFound.mockResolvedValueOnce({
      sessionId: 'session-1',
      created: false,
    });
    createSessionReadyPayload.mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-1',
      joinToken: 'token',
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

    const { startMatchFoundConsumer } = await import('../src/services/matchFoundConsumer');
    await startMatchFoundConsumer(channel as any, {} as any);
    const consumeHandler = channel.consume.mock.calls[0][1];

    await consumeHandler({
      content: Buffer.from(
        JSON.stringify({
          event: 'match',
          data: {
            matchFound: {
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
            },
          },
        }),
      ),
    });

    expect(queueSessionReadyNotification).not.toHaveBeenCalled();
    expect(deliverSessionReadyIfConnected).toHaveBeenCalledTimes(2);
  });

  it('nacks the message when the payload cannot be built', async () => {
    const channel = {
      assertExchange: vi.fn(),
      assertQueue: vi.fn(),
      bindQueue: vi.fn(),
      prefetch: vi.fn(),
      consume: vi.fn(),
      ack: vi.fn(),
      nack: vi.fn(),
    };

    createSessionFromMatchFound.mockResolvedValueOnce({
      sessionId: 'session-1',
      created: true,
    });
    createSessionReadyPayload.mockResolvedValueOnce(null).mockResolvedValueOnce({
      sessionId: 'session-1',
      userId: 'user-2',
      joinToken: 'token',
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

    const { startMatchFoundConsumer } = await import('../src/services/matchFoundConsumer');
    await startMatchFoundConsumer(channel as any, {} as any);
    const consumeHandler = channel.consume.mock.calls[0][1];
    const message = {
      content: Buffer.from(
        JSON.stringify({
          event: 'match',
          data: {
            matchFound: {
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
            },
          },
        }),
      ),
    };

    await consumeHandler(message);

    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });
});
