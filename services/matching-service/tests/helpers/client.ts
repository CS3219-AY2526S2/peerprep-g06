import { io as ioClient, Socket } from 'socket.io-client';

const activeSockets: Socket[] = [];

export function createClient(port: number): Socket {
  const socket = ioClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    autoConnect: false,
  });
  activeSockets.push(socket);
  return socket;
}

export function waitForEvent<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export function waitForConnect(socket: Socket): Promise<void> {
  return new Promise<void>((resolve) => {
    if (socket.connected) {
      resolve();
      return;
    }
    socket.once('connect', () => resolve());
    socket.connect();
  });
}

export async function createConnectedClient(port: number): Promise<Socket> {
  const socket = createClient(port);
  await waitForConnect(socket);
  return socket;
}

export function disconnectAll(): void {
  for (const socket of activeSockets) {
    if (socket.connected) {
      socket.disconnect();
    }
  }
  activeSockets.length = 0;
}
