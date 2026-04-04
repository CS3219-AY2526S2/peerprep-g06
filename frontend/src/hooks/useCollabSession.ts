import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { SessionReadyPayload } from '../../../shared/types';
import {
  createSessionSocket,
  getCollabAccessToken,
  ParticipantStatusPayload,
  SessionEndedPayload,
  SessionJoinedPayload,
  SessionSocket,
} from '@/lib/collab';
import { useAppStore } from '@/store/useAppStore';

const REMOTE_UPDATE_ORIGINS = new Set(['remote', 'remote-sync']);

function encodeUpdateBase64(update: Uint8Array): string {
  let binary = '';
  update.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function decodeUpdateBase64(encodedUpdate: string): Uint8Array {
  const binary = window.atob(encodedUpdate);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function useCollabSession(session: SessionReadyPayload | null) {
  const socketRef = useRef<SessionSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const sharedDocRef = useRef<Y.Doc | null>(null);
  const docObserverRef = useRef<((update: Uint8Array, origin: unknown) => void) | null>(null);
  const isLeavingRef = useRef(false);
  const { setCollabSessionStatus, setCollabError } = useAppStore();

  const [sharedDoc, setSharedDoc] = useState<Y.Doc | null>(null);
  const [joinedSession, setJoinedSession] = useState<SessionJoinedPayload | null>(null);
  const [participantStatuses, setParticipantStatuses] = useState<
    Record<string, ParticipantStatusPayload>
  >({});
  const [sessionEnded, setSessionEnded] = useState<SessionEndedPayload | null>(null);

  const disposeSharedDoc = useCallback(() => {
    if (!sharedDocRef.current) {
      return;
    }

    if (docObserverRef.current) {
      sharedDocRef.current.off('update', docObserverRef.current);
    }

    sharedDocRef.current.destroy();
    sharedDocRef.current = null;
    docObserverRef.current = null;
    setSharedDoc(null);
  }, []);

  const createSharedDoc = useCallback(() => {
    const doc = new Y.Doc();
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (REMOTE_UPDATE_ORIGINS.has(String(origin))) {
        return;
      }

      if (!socketRef.current?.connected) {
        return;
      }

      socketRef.current.emit('doc:update', {
        update: encodeUpdateBase64(update),
      });
    };

    doc.on('update', onUpdate);
    sharedDocRef.current = doc;
    docObserverRef.current = onUpdate;
    setSharedDoc(doc);

    return doc;
  }, []);

  const syncSharedDoc = useCallback(
    (encodedUpdate: string) => {
      disposeSharedDoc();

      const doc = createSharedDoc();
      Y.applyUpdate(doc, decodeUpdateBase64(encodedUpdate), 'remote-sync');
    },
    [createSharedDoc, disposeSharedDoc],
  );

  const disconnect = useCallback(() => {
    if (!socketRef.current) {
      return;
    }

    socketRef.current.disconnect();
    socketRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    if (!session) {
      return;
    }

    disconnect();
    reconnectAttemptRef.current += 1;
    const attempt = reconnectAttemptRef.current;
    isLeavingRef.current = false;

    setJoinedSession(null);
    setParticipantStatuses({});
    setSessionEnded(null);
    setCollabSessionStatus('connecting');
    setCollabError(null);

    try {
      const accessToken = await getCollabAccessToken();
      if (attempt !== reconnectAttemptRef.current) {
        return;
      }

      const socket = createSessionSocket(accessToken, session.sessionId, session.joinToken);
      socketRef.current = socket;

      socket.on('connect', () => {
        setCollabSessionStatus('connected');
        setCollabError(null);
      });

      socket.on('session:joined', (payload) => {
        setJoinedSession(payload);
      });

      socket.on('session:error', ({ message }) => {
        setCollabSessionStatus('error');
        setCollabError(message);
      });

      socket.on('doc:sync', (payload) => {
        syncSharedDoc(payload.update);
      });

      socket.on('doc:update', (payload) => {
        if (!sharedDocRef.current) {
          const doc = createSharedDoc();
          Y.applyUpdate(doc, decodeUpdateBase64(payload.update), 'remote');
          return;
        }

        Y.applyUpdate(sharedDocRef.current, decodeUpdateBase64(payload.update), 'remote');
      });

      socket.on('participant:status', (payload) => {
        setParticipantStatuses((previous) => ({
          ...previous,
          [payload.userId]: payload,
        }));
      });

      socket.on('session:ended', (payload) => {
        setSessionEnded(payload);
        setCollabSessionStatus('disconnected');
      });

      socket.on('connect_error', (error) => {
        setCollabSessionStatus('error');
        setCollabError(error.message || 'Unable to join your collaboration session');
      });

      socket.on('disconnect', (reason) => {
        if (isLeavingRef.current || reason === 'io client disconnect') {
          setCollabSessionStatus('disconnected');
          return;
        }

        setCollabSessionStatus('reconnecting');
        setCollabError(null);
      });

      socket.io.on('reconnect_attempt', () => {
        setCollabSessionStatus('reconnecting');
      });

      socket.io.on('reconnect', () => {
        setCollabSessionStatus('connected');
        setCollabError(null);
      });

      socket.io.on('reconnect_error', () => {
        setCollabSessionStatus('reconnecting');
      });

      socket.io.on('reconnect_failed', () => {
        setCollabSessionStatus('error');
        setCollabError('Unable to reconnect to your session. Please leave and try again.');
      });
    } catch (error) {
      setCollabSessionStatus('error');
      setCollabError(
        error instanceof Error ? error.message : 'Failed to prepare session connection',
      );
    }
  }, [
    createSharedDoc,
    disconnect,
    session,
    setCollabError,
    setCollabSessionStatus,
    syncSharedDoc,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void connect();

    return () => {
      isLeavingRef.current = true;
      disconnect();
      disposeSharedDoc();
    };
  }, [connect, disconnect, disposeSharedDoc, session]);

  const leaveSession = useCallback(() => {
    isLeavingRef.current = true;
    socketRef.current?.emit('session:leave');
    disconnect();
  }, [disconnect]);

  return {
    sharedDoc,
    joinedSession,
    participantStatuses,
    sessionEnded,
    leaveSession,
  };
}
