// Socket.IO notification namespace for pre-session events such as "session-ready".
import { getSupabaseUser } from '../lib/supabase';
import {
  deliverPendingNotifications,
  NotificationServer,
  registerAuthenticatedNotificationSocket,
} from './notificationService';
import {
  AuthenticatedNotificationSocket,
  getBearerToken,
} from './socketAuth';
import { logger } from '../utils/logger';

export function configureNotificationNamespace(io: NotificationServer): void {
  // Every client-facing notification socket is authenticated before it can register for user-targeted events.
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

  io.on('connection', (socket: AuthenticatedNotificationSocket) => {
    const authenticatedUserId = socket.data.userId;
    if (!authenticatedUserId) {
      socket.disconnect(true);
      return;
    }
    logger.info(`Notification socket connected: ${socket.id} for user ${authenticatedUserId}`);
    registerAuthenticatedNotificationSocket(socket, authenticatedUserId);
    void deliverPendingNotifications(io, authenticatedUserId);

    socket.on('notification:register', async () => {
      await deliverPendingNotifications(io, authenticatedUserId);
    });

    socket.on('disconnect', (reason: string) => {
      logger.info(`Notification socket disconnected: ${socket.id}`, reason);
    });
  });
}
