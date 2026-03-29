import { useEffect, useRef } from 'react';
import { SessionReadyPayload } from '../../../shared/types';
import {
  createNotificationSocket,
  getCollabAccessToken,
  NotificationSocket,
} from '@/lib/collab';
import { useAppStore } from '@/store/useAppStore';

export function useCollabNotifications(userId?: string) {
  const socketRef = useRef<NotificationSocket | null>(null);
  const {
    setPendingSession,
    setCollabNotificationStatus,
    setCollabError,
  } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      return;
    }

    const connect = async () => {
      setCollabNotificationStatus('connecting');
      setCollabError(null);

      try {
        const accessToken = await getCollabAccessToken();
        if (!isMounted) {
          return;
        }

        const socket = createNotificationSocket(accessToken);
        socketRef.current = socket;

        socket.on('connect', () => {
          if (!isMounted) {
            return;
          }

          setCollabNotificationStatus('connected');
          socket.emit('notification:register', { userId });
        });

        socket.on('session-ready', (payload: SessionReadyPayload) => {
          if (!isMounted) {
            return;
          }

          setCollabError(null);
          setPendingSession(payload);
        });

        socket.on('notification:error', ({ message }) => {
          if (!isMounted) {
            return;
          }

          setCollabNotificationStatus('error');
          setCollabError(message);
        });

        socket.on('connect_error', (error) => {
          if (!isMounted) {
            return;
          }

          setCollabNotificationStatus('error');
          setCollabError(error.message || 'Failed to connect to collaboration service');
        });

        socket.on('disconnect', () => {
          if (!isMounted) {
            return;
          }

          setCollabNotificationStatus('disconnected');
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCollabNotificationStatus('error');
        setCollabError(
          error instanceof Error ? error.message : 'Failed to prepare collaboration connection',
        );
      }
    };

    void connect();

    return () => {
      isMounted = false;

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setCollabNotificationStatus('disconnected');
    };
  }, [setCollabError, setCollabNotificationStatus, setPendingSession, userId]);
}
