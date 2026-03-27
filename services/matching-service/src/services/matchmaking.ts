import {
    getUsersInQueue,
    removeUserFromQueue,
    getUserRequest,
    claimUserMatch,
    releaseUserMatch,
    storeMatch,
    getQueueKey,
    setUserMatched,
} from './queue';
import {
    Match,
    MatchStatus
} from '../types/match';
import { User } from '../types/user';
import { logger } from '../utils/logger';
import { getRandomQuestion } from './questionService';
import Crypto from 'crypto';

export async function findMatch(user: User): Promise<Match | undefined> {
    const queueKey = getQueueKey(user.difficulty, user.language);
    const candidates = await getUsersInQueue(user.difficulty, user.language);
    if (candidates.length < 2) {
        logger.info(`Not enough users in queue to match ${user.id}`);
        return undefined;
    }

    for (const candidate of candidates) {
        if (candidate.id === user.id) continue;

        const commonTopics = user.topics.filter(topic => candidate.topics.includes(topic));
        if (commonTopics.length === 0) continue;

        // pick topic deterministically so both sides of a concurrent attempt agree
        const commonTopic = [...commonTopics].sort()[0];

        // lock the match
        const isLocked = await lockMatch(user, candidate);
        if (!isLocked) {
            logger.debug(`Could not lock ${user.id} or ${candidate.id}, skipping candidate ${candidate.id}`);
            continue;
        }

        try {
            // re-validate both users under the lock: another worker may have matched them
            // between when we fetched the queue snapshot and when we acquired the locks
            const [userRequest, candidateRequest] = await Promise.all([
                getUserRequest(user.id),
                getUserRequest(candidate.id),
            ]);

            if (
                !userRequest || userRequest.status !== MatchStatus.PENDING ||
                !candidateRequest || candidateRequest.status !== MatchStatus.PENDING
            ) {
                logger.debug(`User state changed before locks were acquired, skipping candidate ${candidate.id}`);
                continue;
            }

            const match = await createMatch(user, candidate, queueKey, commonTopic);
            await storeMatch(match);

            logger.info(`Match ${match.id} created: ${user.id} <-> ${candidate.id} | topic: ${commonTopic}`);
            return match;
        } finally {
            // always release both locks, whether match succeeded or an error occurred
            await releaseUserMatch(user.id);
            await releaseUserMatch(candidate.id);
        }
    }
    logger.info(`No match found for user ${user.id}`);
    return undefined;
}

export async function lockMatch(user: User, candidate: User): Promise<boolean> {
    const [firstId, secondId] = [user.id, candidate.id].sort();
    const firstLocked = await claimUserMatch(firstId);
    if (!firstLocked) {
        logger.debug(`Could not lock ${firstId}, skipping`);
        return false;
    }
    const secondLocked = await claimUserMatch(secondId);
    if (!secondLocked) {
        await releaseUserMatch(firstId);
        logger.debug(`Could not lock ${secondId}, releasing ${firstId} and skipping`);
        return false;
    }
    return true;
}

export async function createMatch(user: User, candidate: User, queueKey: string, commonTopic: string): Promise<Match> {
    const question = await getRandomQuestion(user.difficulty, commonTopic);
    // both users confirmed PENDING under lock - proceed with match
    await removeUserFromQueue(user.id, queueKey);
    logger.debug(`Removed ${user.id} from queue ${queueKey}`);
    await removeUserFromQueue(candidate.id, queueKey);
    logger.debug(`Removed ${candidate.id} from queue ${queueKey}`);

    const startTime = Date.now();
    const matchId = Crypto.randomUUID();

    // set the users to matched
    await setUserMatched(user.id, matchId);
    logger.debug(`Set ${user.id} to matched ${matchId}`);
    await setUserMatched(candidate.id, matchId);
    logger.debug(`Set ${candidate.id} to matched ${matchId}`);

    const match: Match = {
        id: matchId,
        user1Id: user.id,
        user2Id: candidate.id,
        commonTopic,
        question: question,
        difficulty: user.difficulty,
        commonLanguage: user.language,
        createdAt: new Date(startTime),
        status: MatchStatus.MATCHED,
    };

    return match;
}