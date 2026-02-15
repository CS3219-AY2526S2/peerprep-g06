import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err: Error) => {
  logger.error('Redis connection error:', err);
});

export async function connectRedis() {
  try {
    await redisClient.connect();
    logger.info('Redis client ready');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // exit if redis unavailable
    process.exit(1); 
  }
}