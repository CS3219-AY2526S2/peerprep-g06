import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Mock RabbitMQ
vi.mock('../src/config/rabbitmq', () => ({
  setupTopicExchange: vi.fn().mockResolvedValue(undefined),
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock Question Service
vi.mock('../src/services/questionService', () => ({
  getRandomQuestion: vi.fn().mockResolvedValue({
    id: 'q1',
    title: 'Two Sum',
    description: 'Given an array of integers...',
    difficulty: 'easy',
    topic: 'arrays',
  }),
}));

// Override TTL to 2 seconds for faster timeout testing
vi.mock('../src/types/constants', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/types/constants')>();
  return {
    ...original,
    MATCH_PENDING_TTL: 2,
  };
});

import { TestServer, startTestServer, flushRedis } from './helpers/server';
import {
  createConnectedClient,
  waitForEvent,
  disconnectAll,
} from './helpers/client';
import { redis } from '../src/config/redis';

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  disconnectAll();
  await server.cleanup();
});

beforeEach(async () => {
  await flushRedis();
  vi.clearAllMocks();
});

afterEach(() => {
  disconnectAll();
});

describe('Group C: Redis-Dependent', () => {
  it('should emit timeout event when request TTL expires', async () => {
    const client1 = await createConnectedClient(server.port);
    const timeoutPromise = waitForEvent<{ message: string }>(client1, 'timeout', 10000);

    client1.emit('join_queue', {
      userId: 'user-timeout',
      difficulty: 'hard',
      topics: ['dp'],
      language: 'python',
    });

    // Wait for join to process
    await new Promise((r) => setTimeout(r, 200));

    // Verify user is in queue
    let members = await redis.zRange('queue:hard:python', 0, -1);
    expect(members).toContain('user-timeout');

    // Wait for the timeout event (TTL is 2s, Redis expiry notification may take up to ~1s extra)
    const timeout = await timeoutPromise;
    expect(timeout.message).toContain('timed out');

    // Verify user was removed from queue
    members = await redis.zRange('queue:hard:python', 0, -1);
    expect(members).not.toContain('user-timeout');
  }, 15000);

  it('should match users via matchmaking interval when eager match misses', async () => {
    // User A joins first
    const client1 = await createConnectedClient(server.port);
    client1.emit('join_queue', {
      userId: 'user-interval-1',
      difficulty: 'medium',
      topics: ['trees'],
      language: 'java',
    });

    // Wait longer than the eager match window but before the interval fires
    await new Promise((r) => setTimeout(r, 300));

    // User B joins -- eager match should find User A and match immediately,
    // but if not, the 5s interval sweep will catch them
    const client2 = await createConnectedClient(server.port);
    const match1Promise = waitForEvent<{ matchId: string }>(client1, 'match_found', 10000);
    const match2Promise = waitForEvent<{ matchId: string }>(client2, 'match_found', 10000);

    client2.emit('join_queue', {
      userId: 'user-interval-2',
      difficulty: 'medium',
      topics: ['trees'],
      language: 'java',
    });

    const [match1, match2] = await Promise.all([match1Promise, match2Promise]);
    expect(match1.matchId).toBe(match2.matchId);
  }, 15000);
});
