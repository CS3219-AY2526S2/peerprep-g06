import { useCallback, useEffect, useRef, useState } from 'react';
import { SessionReadyPayload } from '../../../shared/types';
import {
  createSessionSocket,
  getCollabAccessToken,
  ParticipantStatusPayload,
  SessionDocumentSyncPayload,
  SessionEndedPayload,
  SessionJoinedPayload,
  SessionSocket,
} from '@/lib/collab';
import { useAppStore } from '@/store/useAppStore';

interface SessionEventLogEntry {
  id: string;
  at: string;
  event: string;
  summary: string;
}

function buildLogEntry(event: string, summary: string): SessionEventLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    event,
    summary,
  };
}

export function useCollabSession(session: SessionReadyPayload | null) {
  const socketRef = useRef<SessionSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const { setCollabSessionStatus, setCollabError } = useAppStore();

  const [joinedSession, setJoinedSession] = useState<SessionJoinedPayload | null>(null);
  const [participantStatuses, setParticipantStatuses] = useState<
    Record<string, ParticipantStatusPayload>
  >({});
  const [latestDocSync, setLatestDocSync] = useState<SessionDocumentSyncPayload | null>(null);
  const [latestDocUpdate, setLatestDocUpdate] = useState<
    (SessionDocumentSyncPayload & { userId: string }) | null
  >(null);
  const [sessionEnded, setSessionEnded] = useState<SessionEndedPayload | null>(null);
  const [eventLog, setEventLog] = useState<SessionEventLogEntry[]>([]);

  const appendLog = useCallback((event: string, summary: string) => {
    setEventLog((previous) => [buildLogEntry(event, summary), ...previous].slice(0, 25));
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!session) {
      return;
    }

    disconnect();
    reconnectAttemptRef.current += 1;
    const attempt = reconnectAttemptRef.current;

    setCollabSessionStatus('connecting');
    setCollabError(null);
    appendLog('session:connect', `Connecting to session ${session.sessionId}`);

    try {
      const accessToken = await getCollabAccessToken();
      if (attempt !== reconnectAttemptRef.current) {
        return;
      }

      const socket = createSessionSocket(accessToken, session.sessionId, session.joinToken);
      socketRef.current = socket;

      socket.on('connect', () => {
        setCollabSessionStatus('connected');
        appendLog('socket:connect', `Connected with socket ${socket.id}`);
      });

      socket.on('session:joined', (payload) => {
        setJoinedSession(payload);
        appendLog('session:joined', `Joined as ${payload.userId}`);
      });

      socket.on('session:error', ({ message }) => {
        setCollabSessionStatus('error');
        setCollabError(message);
        appendLog('session:error', message);
      });

      socket.on('doc:sync', (payload) => {
        setLatestDocSync(payload);
        appendLog('doc:sync', `Received document sync at ${payload.updatedAt}`);
      });

      socket.on('doc:update', (payload) => {
        setLatestDocUpdate(payload);
        appendLog('doc:update', `Received document update from ${payload.userId}`);
      });

      socket.on('participant:status', (payload) => {
        setParticipantStatuses((previous) => ({
          ...previous,
          [payload.userId]: payload,
        }));
        appendLog(
          'participant:status',
          `${payload.userId} is ${payload.status} (${payload.reason})`,
        );
      });

      socket.on('session:ended', (payload) => {
        setSessionEnded(payload);
        appendLog('session:ended', `Session ended at ${payload.endedAt}`);
      });

      socket.on('connect_error', (error) => {
        setCollabSessionStatus('error');
        setCollabError(error.message || 'Failed to connect to session');
        appendLog('connect_error', error.message || 'Failed to connect to session');
      });

      socket.on('disconnect', (reason) => {
        setCollabSessionStatus('disconnected');
        appendLog('socket:disconnect', reason);
      });
    } catch (error) {
      setCollabSessionStatus('error');
      setCollabError(
        error instanceof Error ? error.message : 'Failed to prepare session connection',
      );
      appendLog(
        'session:connect_error',
        error instanceof Error ? error.message : 'Failed to prepare session connection',
      );
    }
  }, [appendLog, disconnect, session, setCollabError, setCollabSessionStatus]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, session]);

  const reconnect = useCallback(() => {
    void connect();
  }, [connect]);

  const leaveSession = useCallback(() => {
    appendLog('session:leave', 'Leaving session');
    socketRef.current?.emit('session:leave');
    disconnect();
  }, [appendLog, disconnect]);

  const clearEventLog = useCallback(() => {
    setEventLog([]);
  }, []);

  return {
    joinedSession,
    participantStatuses,
    latestDocSync,
    latestDocUpdate,
    sessionEnded,
    eventLog,
    reconnect,
    leaveSession,
    clearEventLog,
  };
}
