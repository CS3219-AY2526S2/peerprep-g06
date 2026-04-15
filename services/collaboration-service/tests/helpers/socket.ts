import { AddressInfo } from 'node:net';
import { createServer, Server as HttpServer } from 'node:http';
import { io as createClient, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { Server } from 'socket.io';

export interface IoHarness {
  httpServer: HttpServer;
  io: Server;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function createIoHarness(): Promise<IoHarness> {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });

  const address = httpServer.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    httpServer,
    io,
    baseUrl,
    close: async () => {
      io.close();
      if (!httpServer.listening) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        httpServer.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve();
        });
      });
    },
  };
}

export function createSocketClient(
  url: string,
  options: Partial<ManagerOptions & SocketOptions>,
): Socket {
  return createClient(url, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 5_000,
    ...options,
  });
}

export function waitForEvent<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 5_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      clearTimeout(timeout);
      socket.off(event, onEvent);
      resolve(payload);
    };

    socket.on(event, onEvent);
  });
}

export function waitForConnectError(socket: Socket, timeoutMs = 5_000): Promise<Error> {
  return new Promise<Error>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('connect_error', onError);
      reject(new Error('Timed out waiting for connect_error'));
    }, timeoutMs);

    const onError = (error: Error) => {
      clearTimeout(timeout);
      socket.off('connect_error', onError);
      resolve(error);
    };

    socket.on('connect_error', onError);
  });
}
