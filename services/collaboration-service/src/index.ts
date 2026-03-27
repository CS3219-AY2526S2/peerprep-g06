// Main collaboration-service entrypoint.
// Boots HTTP health checks, the notification socket namespace, Redis, and the MatchFound consumer.
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { config } from './config/env';
import { connectRabbitMq } from './config/rabbitmq';
import { connectRedis } from './config/redis';
import { startMatchFoundConsumer } from './services/matchFoundConsumer';
import { configureNotificationNamespace } from './services/notificationSocket';
import { configureSessionNamespace } from './services/sessionSocket';
import {
  CollaborationSocketClientToServerEvents,
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  CollaborationSocketServerToClientEvents,
} from './types/contracts';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server<
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents
>(server, {
  cors: {
    origin: config.frontendOrigin,
    methods: ['GET', 'POST'],
  },
});

app.use(
  cors({
    origin: config.frontendOrigin,
  }),
);
app.use(express.json());

configureNotificationNamespace(io);
const sessionNamespace = io.of('/session') as unknown as import('socket.io').Namespace<
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents
>;
configureSessionNamespace(sessionNamespace);

app.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'collaboration-service',
    status: 'ok',
    port: config.port,
  });
});

async function bootstrap() {
  // Infrastructure dependencies are required before the service can consume match events safely.
  await connectRedis();
  const { channel } = await connectRabbitMq();
  await startMatchFoundConsumer(channel, io);

  server.listen(config.port, () => {
    logger.info(`Collaboration service listening on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap collaboration service', error);
  process.exit(1);
});
