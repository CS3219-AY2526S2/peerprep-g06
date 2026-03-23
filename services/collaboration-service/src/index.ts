import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { config } from './config/env';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
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

app.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'collaboration-service',
    status: 'ok',
    port: config.port,
  });
});

io.on('connection', (socket) => {
  logger.info(`Notification socket connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    logger.info(`Notification socket disconnected: ${socket.id}`, reason);
  });
});

server.listen(config.port, () => {
  logger.info(`Collaboration service listening on port ${config.port}`);
});
