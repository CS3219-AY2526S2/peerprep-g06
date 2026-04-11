import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { logger } from './utils/logger';
import { connectRedis, setupRedisSubscription } from './config/redis';
import { setupTopicExchange } from './config/rabbitmq';
import { setupSessionManager } from './services/sessionManager';
import { registerHandlers, startMatchmakingInterval } from './handlers/matchingHandler';

// load environment variables
dotenv.config();

export function createApp() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      // TODO: configure to frontend url when deployed
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // middleware
  app.use(cors());
  app.use(express.json());

  // basic health check route
  app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Matching service is running' });
  });

  // socket.io connection handler
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);
    registerHandlers(io, socket);
  });

  return { app, server, io };
}

const PORT = process.env.PORT || 3003;

async function startServer() {
  try {
    const { server, io } = createApp();
    await connectRedis();
    await setupRedisSubscription();
    await setupSessionManager(io);
    await setupTopicExchange();
    startMatchmakingInterval(io);
    logger.info('Redis subscription setup complete');
    server.listen(PORT, () => {
      logger.info(`Matching service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

// only start when running directly, not when imported by tests
if (!process.env.VITEST) {
  startServer();
}
