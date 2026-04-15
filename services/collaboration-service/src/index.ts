// Main collaboration-service entrypoint.
// Boots HTTP health checks, the notification socket namespace, Redis, and the MatchFound consumer.
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Namespace, Server } from 'socket.io';
import dotenv from 'dotenv';
import { config } from './config/env';
import { connectRabbitMq } from './config/rabbitmq';
import { connectRedis } from './config/redis';
import { startMatchFoundConsumer } from './services/matchFoundConsumer';
import { configureNotificationNamespace } from './services/notificationSocket';
import { configureSessionNamespace, recoverScheduledGracePeriods } from './services/sessionSocket';
import {
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents,
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
} from '../../../shared/types';
import { SessionSocketData } from './services/socketAuth';
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
  pingInterval: 10_000,
  pingTimeout: 5_000,
});

app.use(
  cors({
    origin: config.frontendOrigin,
  }),
);
app.use(express.json());

configureNotificationNamespace(io);
const sessionNamespace = io.of('/session') as unknown as Namespace<
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  Record<string, never>,
  SessionSocketData
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
  await recoverScheduledGracePeriods(sessionNamespace);
  await connectRabbitMq((consumerChannel) => startMatchFoundConsumer(consumerChannel, io));

  server.listen(config.port, () => {
    logger.info(`Collaboration service listening on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap collaboration service', error);
  process.exit(1);
});
