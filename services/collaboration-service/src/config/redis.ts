import { createClient } from 'redis';
import { config } from './env';
import { logger } from '../utils/logger';

export const redis = createClient({
  username: config.redis.username,
  password: config.redis.password,
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
});

redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('error', (error: Error) => {
  logger.error('Redis connection error', error);
});

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis;
}
