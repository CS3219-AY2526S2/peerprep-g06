import { Server } from 'socket.io';
import {
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents,
} from '../types/contracts';
import { getSupabaseUser } from '../lib/supabase';
import { deliverPendingNotifications, registerNotificationSocket } from './notificationService';
import { logger } from '../utils/logger';

type NotificationServer = Server<
  CollaborationSocketClientToServerEvents,
  CollaborationSocketServerToClientEvents
>;

function getBearerToken(socket: any): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  return null;
}

export function configureNotificationNamespace(io: NotificationServer): void {
  io.use(async (socket, next) => {
    try {
      const token = getBearerToken(socket);
      if (!token) {
        return next(new Error('Missing access token'));
      }

      const user = await getSupabaseUser(token);
      if (!user) {
        return next(new Error('Invalid access token'));
      }

      socket.data.userId = user.id;
      return next();
    } catch (error) {
      logger.error('Notification socket authentication failed', error);
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: any) => {
    const authenticatedUserId = socket.data.userId as string;
    logger.info(`Notification socket connected: ${socket.id} for user ${authenticatedUserId}`);

    socket.on('notification:register', async (payload: { userId: string }) => {
      if (!payload?.userId || payload.userId !== authenticatedUserId) {
        socket.emit('notification:error', { message: 'User registration mismatch' });
        return;
      }

      registerNotificationSocket(socket, authenticatedUserId);
      await deliverPendingNotifications(io, authenticatedUserId);
    });

    socket.on('disconnect', (reason: string) => {
      logger.info(`Notification socket disconnected: ${socket.id}`, reason);
    });
  });
}
