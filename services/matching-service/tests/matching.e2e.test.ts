import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Mock RabbitMQ before any imports that use it
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

import { TestServer, startTestServer, flushRedis } from './helpers/server';
import { createConnectedClient, waitForEvent, disconnectAll } from './helpers/client';
import { publishEvent } from '../src/config/rabbitmq';
import { getRandomQuestion } from '../src/services/questionService';
import { redis } from '../src/config/redis';
import { Socket } from 'socket.io-client';

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

describe('Group A: Happy Paths', () => {
  it('should match two users with same difficulty, language, and overlapping topic', async () => {
    const client1 = await createConnectedClient(server.port);
    const client2 = await createConnectedClient(server.port);

    const match1Promise = waitForEvent<{
      matchId: string;
      peerId: string;
      question: { id: string };
      difficulty: string;
      topic: string;
      language: string;
    }>(client1, 'match_found');

    const match2Promise = waitForEvent<{
      matchId: string;
      peerId: string;
      question: { id: string };
      difficulty: string;
      topic: string;
      language: string;
    }>(client2, 'match_found');

    client1.emit('join_queue', {
      userId: 'user-1',
      difficulty: 'easy',
      topics: ['arrays', 'strings'],
      language: 'javascript',
    });

    client2.emit('join_queue', {
      userId: 'user-2',
      difficulty: 'easy',
      topics: ['arrays', 'graphs'],
      language: 'javascript',
    });

    const [match1, match2] = await Promise.all([match1Promise, match2Promise]);

    // Both users should receive the same matchId
    expect(match1.matchId).toBe(match2.matchId);

    // Each user's peerId should be the other user
    expect(match1.peerId).toBe('user-2');
    expect(match2.peerId).toBe('user-1');

    // Shared fields
    expect(match1.difficulty).toBe('easy');
    expect(match1.topic).toBe('arrays');
    expect(match1.language).toBe('javascript');
    expect(match1.question.id).toBe('q1');

    // publishEvent should have been called for match.found
    expect(publishEvent).toHaveBeenCalledWith(
      'match',
      'found',
      expect.objectContaining({
        matchFound: expect.objectContaining({
          user1Id: expect.any(String),
          user2Id: expect.any(String),
          difficulty: 'easy',
          topic: 'arrays',
          language: 'javascript',
        }),
      }),
    );
  });

  it('should not emit match_found when only one user is in queue', async () => {
    const client1 = await createConnectedClient(server.port);

    client1.emit('join_queue', {
      userId: 'user-alone',
      difficulty: 'easy',
      topics: ['arrays'],
      language: 'javascript',
    });

    // Wait and verify no match_found fires
    let matched = false;
    client1.on('match_found', () => {
      matched = true;
    });
    await new Promise((r) => setTimeout(r, 1000));
    expect(matched).toBe(false);

    // Verify user is still in Redis queue
    const members = await redis.zRange('queue:easy:javascript', 0, -1);
    expect(members).toContain('user-alone');

    const request = await redis.hGetAll('request:user-alone');
    expect(request.status).toBe('PENDING');
  });

  it('should remove user from queue when they cancel', async () => {
    const client1 = await createConnectedClient(server.port);

    client1.emit('join_queue', {
      userId: 'user-cancel',
      difficulty: 'easy',
      topics: ['arrays'],
      language: 'javascript',
    });

    // Wait briefly for the join to be processed
    await new Promise((r) => setTimeout(r, 200));

    // Verify user is in queue
    let members = await redis.zRange('queue:easy:javascript', 0, -1);
    expect(members).toContain('user-cancel');

    // Cancel
    client1.emit('cancel_queue', { userId: 'user-cancel' });

    // Wait for cancel to be processed
    await new Promise((r) => setTimeout(r, 200));

    // Verify user is removed
    members = await redis.zRange('queue:easy:javascript', 0, -1);
    expect(members).not.toContain('user-cancel');

    const request = await redis.hGetAll('request:user-cancel');
    expect(Object.keys(request)).toHaveLength(0);
  });
});

describe('Group B: Edge Cases', () => {
  it('should handle reconnection with queue_rejoined event', async () => {
    const client1 = await createConnectedClient(server.port);

    client1.emit('join_queue', {
      userId: 'user-reconnect',
      difficulty: 'medium',
      topics: ['trees'],
      language: 'python',
    });

    // Wait for join to be processed
    await new Promise((r) => setTimeout(r, 200));

    // Disconnect
    client1.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    // Reconnect with a new socket but same userId
    const client2 = await createConnectedClient(server.port);
    const rejoinedPromise = waitForEvent<{ timeLeft: number }>(client2, 'queue_rejoined');

    client2.emit('join_queue', {
      userId: 'user-reconnect',
      difficulty: 'medium',
      topics: ['trees'],
      language: 'python',
    });

    const rejoined = await rejoinedPromise;
    expect(rejoined.timeLeft).toBeGreaterThan(0);
    expect(rejoined.timeLeft).toBeLessThanOrEqual(30);
  });

  it('should not match users with no overlapping topics', async () => {
    const client1 = await createConnectedClient(server.port);
    const client2 = await createConnectedClient(server.port);

    client1.emit('join_queue', {
      userId: 'user-a',
      difficulty: 'easy',
      topics: ['arrays'],
      language: 'javascript',
    });

    client2.emit('join_queue', {
      userId: 'user-b',
      difficulty: 'easy',
      topics: ['graphs'],
      language: 'javascript',
    });

    // Wait and verify no match_found fires for either user
    let matched = false;
    client1.on('match_found', () => {
      matched = true;
    });
    client2.on('match_found', () => {
      matched = true;
    });
    await new Promise((r) => setTimeout(r, 1500));
    expect(matched).toBe(false);

    // Both users should still be in the queue
    const members = await redis.zRange('queue:easy:javascript', 0, -1);
    expect(members).toContain('user-a');
    expect(members).toContain('user-b');
  });

  it('should emit queue_error when required fields are missing', async () => {
    const client1 = await createConnectedClient(server.port);
    const errorPromise = waitForEvent<{ message: string }>(client1, 'queue_error');

    // Missing difficulty, topics, language
    client1.emit('join_queue', { userId: 'user-bad' });

    const error = await errorPromise;
    expect(error.message).toContain('Missing required fields');
  });

  it('should keep users in queue when question service fails', async () => {
    // Make getRandomQuestion throw to simulate no questions for this filter
    vi.mocked(getRandomQuestion).mockRejectedValueOnce(
      new Error('Failed to get random question: 404'),
    );

    const client1 = await createConnectedClient(server.port);
    const client2 = await createConnectedClient(server.port);

    let matched = false;
    client1.on('match_found', () => {
      matched = true;
    });
    client2.on('match_found', () => {
      matched = true;
    });

    client1.emit('join_queue', {
      userId: 'user-qfail-1',
      difficulty: 'easy',
      topics: ['arrays'],
      language: 'javascript',
    });

    client2.emit('join_queue', {
      userId: 'user-qfail-2',
      difficulty: 'easy',
      topics: ['arrays'],
      language: 'javascript',
    });

    // Wait for the eager match attempt to process
    await new Promise((r) => setTimeout(r, 1000));

    // No match should have been created
    expect(matched).toBe(false);

    // Both users should still be in the queue
    const members = await redis.zRange('queue:easy:javascript', 0, -1);
    expect(members).toContain('user-qfail-1');
    expect(members).toContain('user-qfail-2');
  });
});
