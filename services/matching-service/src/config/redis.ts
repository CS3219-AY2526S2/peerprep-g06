import { createClient } from 'redis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
dotenv.config();

const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 14059,
    }
});

client.on('connect', () => {
    logger.info('Redis client connected');
});

client.on('error', (err: Error) => {
    logger.error('Redis connection error:', err);
    // exit if redis unavailable
    process.exit(1); 
});

export async function connectRedis() {
    await client.connect();
    logger.info('Redis client connected');
    return client;
}
