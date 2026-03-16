import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
dotenv.config();

let isConnected: boolean = false;
let reconnectAttempts: number = 0;
const maxReconnectAttempts: number = 5;

export const redis: RedisClientType = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 14059,
        reconnectStrategy: (retries: number) => {
            if (retries > maxReconnectAttempts) {
                console.error('Max reconnect attempts reached');
                return new Error('Max reconnect attempts reached');
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`Trying to reconnect in ${delay}ms`);
            return delay;
        }
    },
});

redis.on('connect', () => {
    isConnected = true;
    reconnectAttempts = 0;
    logger.info('Redis client connected');
});

redis.on('error', (err: Error) => {
    logger.error('Redis connection error:', err);
    // exit if redis unavailable
    process.exit(1); 
});

redis.on('reconnecting', (delay: number) => {
    reconnectAttempts++;
    logger.info(`Redis client reconnecting in ${delay}ms`);
});

redis.on('reconnected', () => {
    isConnected = true;
    reconnectAttempts = 0;
    logger.info('Redis client reconnected');
});

redis.on('end', () => {
    isConnected = false;
    reconnectAttempts = 0;
    logger.info('Redis client disconnected');
});

export async function connectRedis() {
    await redis.connect();
    await redis.configSet('notify-keyspace-events', 'Ex');
    return redis;
}