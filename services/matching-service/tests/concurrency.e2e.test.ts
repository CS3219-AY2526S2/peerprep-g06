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

import { TestServer, startTestServer, flushRedis } from './helpers/server';
import {
  createConnectedClient,
  waitForEvent,
  disconnectAll,
} from './helpers/client';

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

describe('Group D: Concurrency', () => {
  it('should match exactly one pair when 3 users join simultaneously', async () => {
    const client1 = await createConnectedClient(server.port);
    const client2 = await createConnectedClient(server.port);
    const client3 = await createConnectedClient(server.port);

    // Collect all match_found events
    const matches: Array<{ userId: string; matchId: string; peerId: string }> = [];

    const collectMatch = (userId: string, client: ReturnType<typeof createConnectedClient> extends Promise<infer T> ? T : never) => {
      return waitForEvent<{ matchId: string; peerId: string }>(client, 'match_found', 10000)
        .then((data) => {
          matches.push({ userId, matchId: data.matchId, peerId: data.peerId });
        })
        .catch(() => {
          // No match for this user -- expected for the odd one out
        });
    };

    const p1 = collectMatch('user-c1', client1);
    const p2 = collectMatch('user-c2', client2);
    const p3 = collectMatch('user-c3', client3);

    // All three join simultaneously
    client1.emit('join_queue', {
      userId: 'user-c1',
      difficulty: 'easy',
      topics: ['arrays'],
      language: 'javascript',
    });
    client2.emit('join_queue', {
      userId: 'user-c2',
      difficulty: 'easy',
      topics: ['arrays'],
      language: 'javascript',
    });
    client3.emit('join_queue', {
      userId: 'user-c3',
      difficulty: 'easy',
      topics: ['arrays'],
      language: 'javascript',
    });

    // Wait for the interval to process (eager match + one interval cycle)
    await new Promise((r) => setTimeout(r, 7000));

    // Cancel all promises that haven't resolved
    await Promise.allSettled([p1, p2, p3]);

    // Exactly 2 users should have been matched (one pair)
    expect(matches).toHaveLength(2);

    // Both matched users should share the same matchId
    expect(matches[0].matchId).toBe(matches[1].matchId);

    // Each matched user's peerId should be the other
    expect(matches[0].peerId).toBe(matches[1].userId);
    expect(matches[1].peerId).toBe(matches[0].userId);

    // The unmatched user should be the one not in matches
    const matchedUserIds = matches.map((m) => m.userId);
    const allUserIds = ['user-c1', 'user-c2', 'user-c3'];
    const unmatchedUsers = allUserIds.filter((id) => !matchedUserIds.includes(id));
    expect(unmatchedUsers).toHaveLength(1);
  }, 15000);
});
