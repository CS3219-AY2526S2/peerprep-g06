import { redis } from '../config/redis';
import { Match, MatchStatus, Difficulty } from '@shared/types';
import { User } from '../types/user';
import { MATCH_LOCK_TTL, MATCH_PENDING_TTL, MATCH_MATCHED_TTL, MATCH_HANDOFF_TTL, MATCH_TIMEOUT_TTL } from '../types/constants';

// returns the queue key for a given difficulty and language
export function getQueueKey(difficulty: Difficulty, language: string): string {
    return `queue:${difficulty}:${language}`;
}

// adds a user to the queue and stores their request details with a timeout
export async function addUserToQueue(user: User): Promise<void> {
    const queueKey = getQueueKey(user.difficulty, user.language);
    // adds the user to the queue of difficulty and language with the score being the join time
    await redis.zAdd(queueKey, { score: user.joinedAt.getTime(), value: user.id });

    await redis.hSet(`request:${user.id}`, {
        difficulty: user.difficulty,
        language: user.language,
        topics: JSON.stringify(user.topics),
        joinedAt: user.joinedAt.toISOString(),
        status: MatchStatus.PENDING,
        socketId: user.socketId,
    });
    // set the request key to expire after the pending timeout
    await redis.expire(`request:${user.id}`, MATCH_PENDING_TTL);
    // add user to queue membership for timeout cleanup
    await redis.set(`queues:${user.id}`, queueKey);
}

// removes a user from their queue and cleans up all associated keys
export async function removeUserFromQueue(userId: string, queueKey: string): Promise<void> {
    // remove matched user from the queue
    await redis.zRem(queueKey, userId);
    // remove user from queue membership regardless of status
    await redis.del(`queues:${userId}`);
}

// updates a user's status to matched
export async function setUserMatched(userId: string, matchId: string): Promise<void> {
    await redis.hSet(`request:${userId}`, { status: MatchStatus.MATCHED, matchId: matchId });
    // set the request key to expire after the matched timeout
    await redis.expire(`request:${userId}`, MATCH_MATCHED_TTL);
}

// updates a user's status to timed out
export async function setUserTimedOut(userId: string): Promise<void> {
    await redis.hSet(`request:${userId}`, { status: MatchStatus.TIMED_OUT });
    // set the request key to expire after the timed out timeout
    await redis.expire(`request:${userId}`, MATCH_TIMEOUT_TTL);
}

// retrieves all users currently waiting in a specific queue, in FIFO order (oldest first)
export async function getUsersInQueue(difficulty: Difficulty, language: string): Promise<User[]> {
    const queueKey = getQueueKey(difficulty, language);

    // return users in the queue in FIFO order
    const ids = await redis.zRange(queueKey, 0, -1);
    const users: User[] = [];

    for (const id of ids) {
        const request = await redis.hGetAll(`request:${id}`);

        if (!request || Object.keys(request).length === 0) continue;
        
        users.push({
            id,
            difficulty: request.difficulty as Difficulty,
            language: request.language,
            topics: JSON.parse(request.topics || '[]'),
            joinedAt: new Date(request.joinedAt),
            status: request.status as MatchStatus,
            socketId: request.socketId,
        } as User);
    }
    return users;
}

// returns a user's raw request record from Redis, or null if expired/not found
export async function getUserRequest(userId: string): Promise<Record<string, string> | null> {
    const request = await redis.hGetAll(`request:${userId}`);
    if (!request || Object.keys(request).length === 0) return null;
    return request;
}

// atomically claims a match lock for a user using SET NX EX (single atomic command)
export async function claimUserMatch(userId: string): Promise<boolean> {
    const result = await redis.set(`lock:match:${userId}`, '1', { NX: true, EX: MATCH_LOCK_TTL });
    return result === 'OK';
}

// releases the match lock for a user after match processing is complete or if claim failed
export async function releaseUserMatch(userId: string): Promise<void> {
    await redis.del(`lock:match:${userId}`);
}

// stores a match record in Redis
export async function storeMatch(match: Match): Promise<void> {
    await redis.hSet(`match:${match.id}`, {
        user1Id: match.user1Id,
        user2Id: match.user2Id,
        commonTopic: match.commonTopic,
        question: JSON.stringify(match.question),
        difficulty: match.difficulty,
        commonLanguage: match.commonLanguage,
        createdAt: match.createdAt.getTime(),
        status: match.status,
    });

    await redis.expire(`match:${match.id}`, MATCH_HANDOFF_TTL);
}
