import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ConnectionStatus, useAppStore } from '@/store/useAppStore';

const REMOTE_UPDATE_ORIGINS = new Set(['remote', 'remote-sync']);

type TerminalReconnectStatus = Extract<ConnectionStatus, 'reconnect-failed' | 'grace-expired'>;

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

function classifySessionError(
  message: string,
  isRecoveryAttempt: boolean,
): { status: ConnectionStatus; message: string } {
  switch (message) {
    case 'SESSION_EXPIRED':
      return {
        status: 'grace-expired',
        message: 'You were disconnected too long and your reserved place in this session expired.',
      };
    case 'SESSION_ENDED':
      return {
        status: 'ended',
        message: 'This collaboration session has already ended.',
      };
    case 'SESSION_SUPERSEDED':
      return {
        status: 'reconnect-failed',
        message: 'This session was reopened in another tab or device.',
      };
    case 'SESSION_NOT_FOUND':
      return {
        status: isRecoveryAttempt ? 'grace-expired' : 'error',
        message: isRecoveryAttempt
          ? 'Your session is no longer available to resume.'
          : 'Unable to find this collaboration session.',
      };
    case 'INVALID_SESSION_TOKEN':
      return {
        status: isRecoveryAttempt ? 'grace-expired' : 'error',
        message: isRecoveryAttempt
          ? 'Your reconnect token is no longer valid for this session.'
          : 'Your session credentials are no longer valid.',
      };
    case 'INVALID_ACCESS_TOKEN':
      return {
        status: 'error',
        message: 'Your login session has expired. Please sign in again.',
      };
    case 'USER_NOT_IN_SESSION':
      return {
        status: 'error',
        message: 'Your account is not allowed to join this session.',
      };
    default:
      return {
        status: isRecoveryAttempt ? 'reconnect-failed' : 'error',
        message: isRecoveryAttempt
          ? 'Unable to reconnect to your session. Please leave and try again.'
          : message || 'Unable to join your collaboration session.',
      };
  }
}

function calculateReconnectAttempts(gracePeriodMs: number): number {
  const attemptWindowMs = 4_000;
  return Math.max(5, Math.ceil(gracePeriodMs / attemptWindowMs));
}

export function useCollabSession(session: SessionReadyPayload | null) {
  const socketRef = useRef<SessionSocket | null>(null);
  const activeConnectionIdRef = useRef(0);
  const isDisposedRef = useRef(false);
  const sharedDocRef = useRef<Y.Doc | null>(null);
  const docObserverRef = useRef<((update: Uint8Array, origin: unknown) => void) | null>(null);
  const recoverySyncTimeoutRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isLeavingRef = useRef(false);
  const hasEverBeenLiveRef = useRef(false);
  const isRecoveryAttemptRef = useRef(false);
  const awaitingSyncRef = useRef(false);
  const terminalStatusRef = useRef<ConnectionStatus | null>(null);
  const { setCollabSessionStatus, setCollabError } = useAppStore();

  const [sharedDoc, setSharedDoc] = useState<Y.Doc | null>(null);
  const [joinedSession, setJoinedSession] = useState<SessionJoinedPayload | null>(null);
  const [participantStatuses, setParticipantStatuses] = useState<
    Record<string, ParticipantStatusPayload>
  >({});
  const [sessionEnded, setSessionEnded] = useState<SessionEndedPayload | null>(null);

  const reconnectAttempts = useMemo(
    () => calculateReconnectAttempts(session?.gracePeriodMs ?? 30_000),
    [session?.gracePeriodMs],
  );

  const markStatus = useCallback(
    (status: ConnectionStatus, error: string | null = null) => {
      setCollabSessionStatus(status);
      setCollabError(error);
    },
    [setCollabError, setCollabSessionStatus],
  );

  const clearRecoverySyncTimeout = useCallback(() => {
    if (recoverySyncTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(recoverySyncTimeoutRef.current);
    recoverySyncTimeoutRef.current = null;
  }, []);

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

  const stopSocketReconnection = useCallback(() => {
    if (!socketRef.current) {
      return;
    }

    clearRecoverySyncTimeout();
    socketRef.current.io.opts.reconnection = false;
    socketRef.current.disconnect();
  }, [clearRecoverySyncTimeout]);

  const markTerminalReconnectState = useCallback(
    (status: TerminalReconnectStatus, error: string) => {
      terminalStatusRef.current = status;
      awaitingSyncRef.current = false;
      isRecoveryAttemptRef.current = false;
      markStatus(status, error);
      stopSocketReconnection();
    },
    [markStatus, stopSocketReconnection],
  );

  const disconnect = useCallback(() => {
    if (!socketRef.current) {
      return;
    }

    clearRecoverySyncTimeout();
    socketRef.current.disconnect();
    socketRef.current = null;
  }, [clearRecoverySyncTimeout]);

  const connect = useCallback(async () => {
    if (!session) {
      return;
    }

    isDisposedRef.current = false;
    disconnect();
    const connectionId = activeConnectionIdRef.current + 1;
    activeConnectionIdRef.current = connectionId;
    clearRecoverySyncTimeout();
    isLeavingRef.current = false;
    hasEverBeenLiveRef.current = false;
    isRecoveryAttemptRef.current = false;
    awaitingSyncRef.current = false;
    terminalStatusRef.current = null;

    setJoinedSession(null);
    setParticipantStatuses({});
    setSessionEnded(null);
    markStatus('joining');

    try {
      const accessToken = await getCollabAccessToken();

      const socket = createSessionSocket(
        accessToken,
        session.sessionId,
        session.joinToken,
        reconnectAttempts,
      );

      if (isDisposedRef.current) {
        socket.disconnect();
        return;
      }

      socketRef.current = socket;

      const isActiveSocket = () =>
        !isDisposedRef.current &&
        socketRef.current === socket &&
        activeConnectionIdRef.current === connectionId;

      const scheduleRecoverySyncFallback = () => {
        if (!isActiveSocket()) {
          return;
        }

        clearRecoverySyncTimeout();
        if (!hasEverBeenLiveRef.current || !sharedDocRef.current) {
          return;
        }

        recoverySyncTimeoutRef.current = window.setTimeout(() => {
          if (
            !isActiveSocket() ||
            terminalStatusRef.current ||
            !isRecoveryAttemptRef.current ||
            !awaitingSyncRef.current ||
            !socket.connected
          ) {
            return;
          }

          awaitingSyncRef.current = false;
          isRecoveryAttemptRef.current = false;
          terminalStatusRef.current = null;
          markStatus('live');
        }, 1500);
      };

      socket.on('connect', () => {
        if (!isActiveSocket()) {
          return;
        }

        if (terminalStatusRef.current) {
          return;
        }

        if (isRecoveryAttemptRef.current) {
          awaitingSyncRef.current = true;
          markStatus('rejoined-awaiting-sync');
          scheduleRecoverySyncFallback();
          return;
        }

        markStatus('joining');
      });

      socket.on('session:joined', (payload) => {
        if (!isActiveSocket()) {
          return;
        }

        setJoinedSession(payload);

        if (terminalStatusRef.current) {
          return;
        }

        if (isRecoveryAttemptRef.current) {
          awaitingSyncRef.current = true;
          markStatus('rejoined-awaiting-sync');
          scheduleRecoverySyncFallback();
        }
      });

      socket.on('session:error', ({ message }) => {
        if (!isActiveSocket()) {
          return;
        }

        const isSessionLifecycleCode = /^[A-Z_]+$/.test(message);
        if (
          !isSessionLifecycleCode &&
          hasEverBeenLiveRef.current &&
          !isRecoveryAttemptRef.current &&
          !awaitingSyncRef.current
        ) {
          setCollabError(message);
          return;
        }

        const outcome = classifySessionError(message, isRecoveryAttemptRef.current);

        if (outcome.status === 'grace-expired' || outcome.status === 'reconnect-failed') {
          markTerminalReconnectState(outcome.status, outcome.message);
          return;
        }

        if (outcome.status === 'ended') {
          setSessionEnded({
            sessionId: session.sessionId,
            reason: 'all-participants-left',
            endedAt: new Date().toISOString(),
          });
        }

        clearRecoverySyncTimeout();
        awaitingSyncRef.current = false;
        isRecoveryAttemptRef.current = false;
        markStatus(outcome.status, outcome.message);
      });

      socket.on('doc:sync', (payload) => {
        if (!isActiveSocket()) {
          return;
        }

        syncSharedDoc(payload.update);
        clearRecoverySyncTimeout();
        hasEverBeenLiveRef.current = true;
        awaitingSyncRef.current = false;
        isRecoveryAttemptRef.current = false;
        terminalStatusRef.current = null;
        markStatus('live');
      });

      socket.on('doc:update', (payload) => {
        if (!isActiveSocket()) {
          return;
        }

        if (!sharedDocRef.current) {
          const doc = createSharedDoc();
          Y.applyUpdate(doc, decodeUpdateBase64(payload.update), 'remote');
          return;
        }

        Y.applyUpdate(sharedDocRef.current, decodeUpdateBase64(payload.update), 'remote');
      });

      socket.on('participant:status', (payload) => {
        if (!isActiveSocket()) {
          return;
        }

        setParticipantStatuses((previous) => ({
          ...previous,
          [payload.userId]: payload,
        }));
      });

      socket.on('session:ended', (payload) => {
        if (!isActiveSocket()) {
          return;
        }

        setSessionEnded(payload);
        markStatus('ended');
      });

      socket.on('connect_error', (error) => {
        if (!isActiveSocket()) {
          return;
        }

        const isRecoveryAttempt = isRecoveryAttemptRef.current || hasEverBeenLiveRef.current;
        const outcome = classifySessionError(
          error.message || 'Unable to join your collaboration session.',
          isRecoveryAttempt,
        );

        if (isRecoveryAttempt) {
          if (outcome.status === 'grace-expired' || outcome.status === 'reconnect-failed') {
            markTerminalReconnectState(outcome.status, outcome.message);
            return;
          }

          if (outcome.status === 'ended') {
            clearRecoverySyncTimeout();
            setSessionEnded({
              sessionId: session.sessionId,
              reason: 'all-participants-left',
              endedAt: new Date().toISOString(),
            });
            awaitingSyncRef.current = false;
            isRecoveryAttemptRef.current = false;
            markStatus('ended', outcome.message);
            return;
          }

          awaitingSyncRef.current = false;
          markStatus('reconnecting');
          return;
        }

        if (outcome.status === 'ended') {
          setSessionEnded({
            sessionId: session.sessionId,
            reason: 'all-participants-left',
            endedAt: new Date().toISOString(),
          });
        }

        clearRecoverySyncTimeout();
        awaitingSyncRef.current = false;
        isRecoveryAttemptRef.current = false;
        markStatus(outcome.status, outcome.message);
      });

      socket.on('disconnect', (reason) => {
        if (!isActiveSocket()) {
          return;
        }

        if (terminalStatusRef.current) {
          return;
        }

        if (isLeavingRef.current || reason === 'io client disconnect') {
          markStatus('disconnected');
          return;
        }

        clearRecoverySyncTimeout();
        isRecoveryAttemptRef.current = hasEverBeenLiveRef.current;
        awaitingSyncRef.current = false;
        markStatus('reconnecting');

        if (reason === 'io server disconnect') {
          queueMicrotask(() => {
            if (!isActiveSocket() || terminalStatusRef.current || isLeavingRef.current) {
              return;
            }

            socket.connect();
          });
        }
      });

      socket.io.on('reconnect_attempt', () => {
        if (!isActiveSocket()) {
          return;
        }

        if (terminalStatusRef.current || isLeavingRef.current) {
          return;
        }

        isRecoveryAttemptRef.current = true;
        awaitingSyncRef.current = false;
        markStatus('reconnecting');
      });

      socket.io.on('reconnect', () => {
        if (!isActiveSocket()) {
          return;
        }

        if (terminalStatusRef.current) {
          return;
        }

        isRecoveryAttemptRef.current = true;
        awaitingSyncRef.current = true;
        markStatus('rejoined-awaiting-sync');
        scheduleRecoverySyncFallback();
      });

      socket.io.on('reconnect_error', () => {
        if (!isActiveSocket()) {
          return;
        }

        if (terminalStatusRef.current || isLeavingRef.current) {
          return;
        }

        isRecoveryAttemptRef.current = true;
        awaitingSyncRef.current = false;
        markStatus('reconnecting');
      });

      socket.io.on('reconnect_failed', () => {
        if (!isActiveSocket()) {
          return;
        }

        markTerminalReconnectState(
          'reconnect-failed',
          'Unable to reconnect to your session. Please leave and try again.',
        );
      });
    } catch (error) {
      markStatus(
        'error',
        error instanceof Error ? error.message : 'Failed to prepare session connection',
      );
    }
  }, [
    clearRecoverySyncTimeout,
    createSharedDoc,
    disconnect,
    markStatus,
    markTerminalReconnectState,
    reconnectAttempts,
    session,
    syncSharedDoc,
  ]);

  useEffect(() => {
    if (session?.sessionId === sessionIdRef.current) {
      return;
    }

    sessionIdRef.current = session?.sessionId ?? null;
    setJoinedSession(null);
    setParticipantStatuses({});
    setSessionEnded(null);
    disposeSharedDoc();
  }, [disposeSharedDoc, session?.sessionId]);

  useEffect(() => {
    isDisposedRef.current = false;

    if (!session) {
      return;
    }

    const handleOffline = () => {
      if (terminalStatusRef.current || isLeavingRef.current || !hasEverBeenLiveRef.current) {
        return;
      }

      clearRecoverySyncTimeout();
      isRecoveryAttemptRef.current = true;
      awaitingSyncRef.current = false;
      markStatus('reconnecting');
    };

    const handleOnline = () => {
      if (terminalStatusRef.current || isLeavingRef.current) {
        return;
      }

      if (socketRef.current?.connected && hasEverBeenLiveRef.current) {
        clearRecoverySyncTimeout();
        awaitingSyncRef.current = false;
        isRecoveryAttemptRef.current = false;
        terminalStatusRef.current = null;
        markStatus('live');
        return;
      }

      if (socketRef.current && !socketRef.current.connected) {
        isRecoveryAttemptRef.current = true;
        awaitingSyncRef.current = false;
        markStatus('reconnecting');
        socketRef.current.connect();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [clearRecoverySyncTimeout, markStatus, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void connect();

    return () => {
      isDisposedRef.current = true;
      isLeavingRef.current = true;
      disconnect();
      disposeSharedDoc();
    };
  }, [connect, disconnect, disposeSharedDoc, session]);

  const leaveSession = useCallback(() => {
    isLeavingRef.current = true;
    clearRecoverySyncTimeout();
    socketRef.current?.emit('session:leave');
    disconnect();
  }, [clearRecoverySyncTimeout, disconnect]);

  return {
    sharedDoc,
    joinedSession,
    participantStatuses,
    sessionEnded,
    leaveSession,
  };
}
