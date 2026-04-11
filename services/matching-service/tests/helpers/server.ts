import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { AddressInfo } from 'net';
import { createApp } from '../../src/index';
import { connectRedis, redis, pubsub, setupRedisSubscription } from '../../src/config/redis';
import { setupSessionManager } from '../../src/services/sessionManager';
import { startMatchmakingInterval } from '../../src/handlers/matchingHandler';

export interface TestServer {
  httpServer: HttpServer;
  io: SocketServer;
  port: number;
  matchmakingInterval: NodeJS.Timeout;
  cleanup: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  await connectRedis();
  await setupRedisSubscription();

  const { server, io } = createApp();
  await setupSessionManager(io);
  const matchmakingInterval = startMatchmakingInterval(io);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const port = (server.address() as AddressInfo).port;

  const cleanup = async () => {
    clearInterval(matchmakingInterval);
    io.close();
    server.close();
    await pubsub.quit();
    await redis.quit();
  };

  return { httpServer: server, io, port, matchmakingInterval, cleanup };
}

export async function flushRedis(): Promise<void> {
  await redis.flushDb();
}
