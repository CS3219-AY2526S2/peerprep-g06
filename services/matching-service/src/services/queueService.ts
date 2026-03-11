import { redis } from '../config/redis';
import { User, Difficulty } from '../types/types';

const MATCH_TIMEOUT_SECONDS = parseInt(process.env.MATCHING_TIMEOUT || '30000') / 1000;
const QUEUE_MEMBERSHIP_TTL = MATCH_TIMEOUT_SECONDS + 5;
const MATCH_LOCK_TTL = 5;

function getQueueKey(difficulty: Difficulty, language: string): string {
    return `queue:${difficulty}:${language}`;
}

// adds a user to all their topic queues and stores their request details with a timeout
export async function addUserToQueue(user: User): Promise<void> {
    const queueKey = getQueueKey(user.difficulty, user.language);
    // add userId as a member to each difficulty:language sorted set, scored by join time (FIFO)
    await redis.zAdd(queueKey, { score: user.joinedAt.getTime(), value: user.id });

    // store full user details in a hash
    await redis.hSet(`request:${user.id}`, {
        difficulty: user.difficulty,
        language: user.language,
        joinedAt: user.joinedAt.toISOString(),
        status: 'PENDING',
        socketId: user.socketId,
    });
    // expire request key after timeout duration - this triggers the timeout notification
    await redis.expire(`request:${user.id}`, MATCH_TIMEOUT_SECONDS);

    // store queue membership so we know which queues to clean up on timeout
    await redis.setEx(`queues:${user.id}`, QUEUE_MEMBERSHIP_TTL, JSON.stringify(queueKey));
}

// removes a user from all their queues and cleans up their request and queue membership keys
export async function removeUserFromQueue(userId: string, queueKey: string): Promise<void> {
    // remove userId from the sorted set
    await redis.zRem(queueKey, userId);

    await redis.del(`request:${userId}`);
}

// retrieves all users currently waiting in a specific queue, in FIFO order (oldest first)
export async function getUsersInQueue(difficulty: Difficulty, language: string): Promise<User[]> {
    const queueKey = getQueueKey(difficulty, language);

    // ZRANGE returns members sorted by score (join timestamp) ascending = FIFO order
    const ids = await redis.zRange(queueKey, 0, -1);
    const users: User[] = [];

    for (const id of ids) {
        const request = await redis.hGetAll(`request:${id}`);

        // skip entries whose request key has already expired (timed out)
        if (!request || Object.keys(request).length === 0) continue;

        users.push({
            id,
            difficulty: request.difficulty as Difficulty,
            language: request.language,
            joinedAt: new Date(request.joinedAt),
            status: request.status as 'PENDING' | 'MATCHED' | 'CANCELLED' | 'TIMED_OUT',
            socketId: request.socketId,
            topics: [],
        } as User);
    }
    return users;
}

// returns the queue key a user is currently enrolled in
export async function getUserQueueKey(userId: string): Promise<string> {
    const data = await redis.get(`queues:${userId}`);
    if (!data) return '';
    return data as string;
}

// atomically claims a match lock for a user using SET NX EX (single atomic command)
// returns true if the lock was successfully acquired, false if already claimed
export async function claimUserMatch(userId: string): Promise<boolean> {
    const result = await redis.set(`lock:match:${userId}`, '1', { NX: true, EX: MATCH_LOCK_TTL });
    return result === 'OK';
}

// releases the match lock for a user after match processing is complete or if claim failed
export async function releaseUserMatch(userId: string): Promise<void> {
    await redis.del(`lock:match:${userId}`);
}
