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
import {
  CollaborationSocketClientToServerEvents,
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

app.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'collaboration-service',
    status: 'ok',
    port: config.port,
  });
});

async function bootstrap() {
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
