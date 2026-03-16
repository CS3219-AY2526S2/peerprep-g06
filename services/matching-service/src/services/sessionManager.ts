import { redis, pubsub } from '../config/redis';
import { releaseUserMatch, removeUserFromQueue, setUserTimedOut } from './queue';
import { Server } from 'socket.io';
import { logger } from '../utils/logger';

async function handleTimeout(io: Server, message: string) {
    if (!message.startsWith('request:')) {
        return;
    }
    // get the userId, as the key is in the format of request:<userId>
    const userId = message.substring(message.indexOf(':') + 1);
    if (!userId) {
        logger.error(`Invalid message: ${message}`);
        return;
    }
    try {
        await onRequestExpired(io, userId);
    } catch (error) {
        logger.error(`Error handling timeout for user ${userId}:`, error);
        return;
    }
}

async function onRequestExpired(io: Server, userId: string) {
    // get the queue key the user is in
    const queueKey = await redis.get(`queues:${userId}`);
    if (!queueKey) {
        logger.warn(`Queue key not found for user: ${userId}`);
        return;
    }
    // remove the user from the queue
    await removeUserFromQueue(userId, queueKey);
    logger.info(`Removed user ${userId} from queue ${queueKey}`);

    // set the user to timed out
    await setUserTimedOut(userId);
    logger.info(`Set user ${userId} to timed out`);

    // release any locked matches for the user, as a fallback 
    await releaseUserMatch(userId);
    logger.info(`Released any locked matches for user ${userId}`);

    // emit to the user that they have been timed out
    io.to(userId).emit('timeout', {
        message: 'You have been timed out due to inactivity',
    });
}

export async function setupSessionManager(io: Server) {
    // listen for expired keys on the pubsub channel
    try {
        await pubsub.pSubscribe('__keyevent@0__:expired', async (message: string) => await handleTimeout(io, message));
    } catch (error) {
        logger.error('Error setting up session manager:', error);
        throw error;
    }
    logger.info('Session manager setup complete');
}