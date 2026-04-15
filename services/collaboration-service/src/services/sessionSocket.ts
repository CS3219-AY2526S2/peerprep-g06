// Socket.IO namespace for authenticated session joins.
// This only admits the two users associated with a session and prepares the room for later realtime editing.
import { Namespace } from 'socket.io';
import { getSupabaseUser } from '../lib/supabase';
import {
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  ParticipantStatusPayload,
  SessionDocumentSyncPayload,
  SessionDocumentUpdatePayload,
  SessionEndedPayload,
  SessionJoinedPayload,
} from '../../../../shared/types';
import {
  clearGracePeriod,
  deleteSessionState,
  getGracePeriod,
  getParticipants,
  getSession,
  getStoredJoinToken,
  hashJoinToken,
  listGracePeriods,
  saveGracePeriod,
  updateParticipantPresence,
  updateSessionStatus,
} from './sessionPersistence';
import {
  applyDocumentUpdate,
  disposeDocument,
  flushDocumentSnapshot,
  getDocumentSyncPayload,
} from './documentSyncService';
import { logger } from '../utils/logger';
import { AuthenticatedSessionSocket, SessionSocketData, getBearerToken } from './socketAuth';
import { StoredJoinToken } from '../types/session';
import { persistSessionAttemptHistory } from './attemptHistory';
import {
  getParticipantConnectedReason,
  isSessionComplete,
  resolveParticipantJoinFailureCode,
  shouldHandleUnexpectedDisconnect,
} from './sessionLifecycle';

const SESSION_ROOM_PREFIX = 'session:';
const graceTimeouts = new Map<string, NodeJS.Timeout>();

type SessionNamespace = Namespace<
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  Record<string, never>,
  SessionSocketData
>;

function getSessionRoom(sessionId: string): string {
  return `${SESSION_ROOM_PREFIX}${sessionId}`;
}

function joinSessionRoom(socket: AuthenticatedSessionSocket, sessionId: string): void {
  socket.join(getSessionRoom(sessionId));
}

function disconnectSupersededSocket(
  namespace: SessionNamespace,
  socketId?: string,
  reasonCode?: string,
): void {
  if (!socketId) {
    return;
  }

  const staleSocket = namespace.sockets.get(socketId);
  if (!staleSocket) {
    return;
  }

  staleSocket.data.superseded = true;
  if (reasonCode) {
    staleSocket.emit('session:error', { message: reasonCode });
  }
  staleSocket.disconnect(true);
}

function emitDocumentSync(
  socket: AuthenticatedSessionSocket,
  payload: SessionDocumentSyncPayload,
): void {
  socket.emit('doc:sync', payload);
}

function emitDocumentUpdateToPeers(
  namespace: SessionNamespace,
  sessionId: string,
  excludedSocketId: string,
  payload: SessionDocumentSyncPayload & { userId: string },
): void {
  namespace.except(excludedSocketId).to(getSessionRoom(sessionId)).emit('doc:update', payload);
}

function emitParticipantStatus(
  namespace: SessionNamespace,
  sessionId: string,
  payload: ParticipantStatusPayload,
  excludedSocketId?: string,
): void {
  const room = getSessionRoom(sessionId);

  if (excludedSocketId) {
    namespace.except(excludedSocketId).to(room).emit('participant:status', payload);
    return;
  }

  namespace.to(room).emit('participant:status', payload);
}

function emitSessionEnded(
  namespace: SessionNamespace,
  sessionId: string,
  payload: SessionEndedPayload,
): void {
  namespace.to(getSessionRoom(sessionId)).emit('session:ended', payload);
}

function getGraceTimeoutKey(sessionId: string, userId: string): string {
  return `${sessionId}:${userId}`;
}

function getHandshakeString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function clearScheduledGraceTimeout(sessionId: string, userId: string): void {
  const timeoutKey = getGraceTimeoutKey(sessionId, userId);
  const existingTimeout = graceTimeouts.get(timeoutKey);

  if (existingTimeout) {
    clearTimeout(existingTimeout);
    graceTimeouts.delete(timeoutKey);
  }
}

export function isStoredJoinTokenValid(
  sessionId: string,
  userId: string,
  providedJoinToken: string,
  storedJoinToken: StoredJoinToken,
  nowIso = new Date().toISOString(),
): boolean {
  return (
    storedJoinToken.claims.sessionId === sessionId &&
    storedJoinToken.claims.userId === userId &&
    storedJoinToken.claims.expiresAt > nowIso &&
    hashJoinToken(providedJoinToken) === storedJoinToken.tokenHash
  );
}

interface SessionCleanupDependencies {
  updateSessionStatus: typeof updateSessionStatus;
  flushDocumentSnapshot: typeof flushDocumentSnapshot;
  persistSessionAttemptHistory: typeof persistSessionAttemptHistory;
  disposeDocument: typeof disposeDocument;
  deleteSessionState: typeof deleteSessionState;
}

const defaultSessionCleanupDependencies: SessionCleanupDependencies = {
  updateSessionStatus,
  flushDocumentSnapshot,
  persistSessionAttemptHistory,
  disposeDocument,
  deleteSessionState,
};

export async function cleanupEndedSession(
  namespace: SessionNamespace,
  sessionId: string,
  deps: SessionCleanupDependencies = defaultSessionCleanupDependencies,
): Promise<void> {
  const endedAt = new Date().toISOString();
  const endedPayload: SessionEndedPayload = {
    sessionId,
    reason: 'all-participants-left',
    endedAt,
  };

  await deps.updateSessionStatus(sessionId, 'ended');
  emitSessionEnded(namespace, sessionId, endedPayload);

  try {
    await deps.flushDocumentSnapshot(sessionId);
  } catch (error) {
    logger.error(`Failed to flush document snapshot for session ${sessionId}`, error);
  }

  try {
    await deps.persistSessionAttemptHistory(sessionId);
  } catch (error) {
    logger.error(`Failed to persist attempt history for session ${sessionId}`, error);
  } finally {
    let teardownError: Error | null = null;

    try {
      await deps.disposeDocument(sessionId);
    } catch (error) {
      logger.error(`Failed to dispose in-memory document for session ${sessionId}`, error);
      teardownError = error instanceof Error ? error : new Error(String(error));
    }

    try {
      await deps.deleteSessionState(sessionId);
    } catch (error) {
      logger.error(`Failed to delete persisted session state for session ${sessionId}`, error);
      teardownError ??= error instanceof Error ? error : new Error(String(error));
    }

    if (teardownError) {
      throw teardownError;
    }
  }
}

async function endSessionIfComplete(
  namespace: SessionNamespace,
  sessionId: string,
): Promise<boolean> {
  const participants = await getParticipants(sessionId);
  if (!isSessionComplete(participants)) {
    return false;
  }

  await cleanupEndedSession(namespace, sessionId);
  return true;
}

function scheduleGraceExpiry(
  namespace: SessionNamespace,
  sessionId: string,
  userId: string,
  gracePeriodMs: number,
): void {
  clearScheduledGraceTimeout(sessionId, userId);

  const timeoutKey = getGraceTimeoutKey(sessionId, userId);
  const timeout = setTimeout(() => {
    void handleGraceExpiry(namespace, sessionId, userId);
  }, gracePeriodMs);

  graceTimeouts.set(timeoutKey, timeout);
}

async function handleGraceExpiry(
  namespace: SessionNamespace,
  sessionId: string,
  userId: string,
): Promise<void> {
  clearScheduledGraceTimeout(sessionId, userId);

  const [session, participants, gracePeriod] = await Promise.all([
    getSession(sessionId),
    getParticipants(sessionId),
    getGracePeriod(sessionId, userId),
  ]);

  if (!session || !participants || !gracePeriod) {
    return;
  }

  const participant = participants.find((entry) => entry.userId === userId);
  if (!participant || participant.status !== 'disconnected') {
    await clearGracePeriod(sessionId, userId);
    return;
  }

  if (gracePeriod.expiresAt > new Date().toISOString()) {
    scheduleGraceExpiry(
      namespace,
      sessionId,
      userId,
      new Date(gracePeriod.expiresAt).getTime() - Date.now(),
    );
    return;
  }

  const leftAt = new Date().toISOString();
  await updateParticipantPresence(sessionId, userId, {
    status: 'left',
    socketId: undefined,
    disconnectedAt: leftAt,
  });
  await clearGracePeriod(sessionId, userId);

  emitParticipantStatus(namespace, sessionId, {
    sessionId,
    userId,
    status: 'left',
    reason: 'grace-expired',
    at: leftAt,
  });

  await endSessionIfComplete(namespace, sessionId);
}

export async function recoverScheduledGracePeriods(namespace: SessionNamespace): Promise<void> {
  const gracePeriods = await listGracePeriods();
  let scheduledCount = 0;

  for (const gracePeriod of gracePeriods) {
    const session = await getSession(gracePeriod.sessionId);
    if (!session || session.status === 'ended') {
      await clearGracePeriod(gracePeriod.sessionId, gracePeriod.userId);
      continue;
    }

    const remainingMs = new Date(gracePeriod.expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      await handleGraceExpiry(namespace, gracePeriod.sessionId, gracePeriod.userId);
      continue;
    }

    scheduleGraceExpiry(namespace, gracePeriod.sessionId, gracePeriod.userId, remainingMs);
    scheduledCount += 1;
  }

  logger.info(`Recovered ${scheduledCount} active grace-period timers`);
}

async function handleParticipantLeave(
  namespace: SessionNamespace,
  socket: AuthenticatedSessionSocket,
): Promise<void> {
  if (socket.data.leaveHandled) {
    return;
  }

  socket.data.leaveHandled = true;
  socket.data.explicitLeave = true;

  const userId = socket.data.userId;
  const sessionId = socket.data.sessionId;
  if (!userId || !sessionId) {
    return;
  }
  const leftAt = new Date().toISOString();

  clearScheduledGraceTimeout(sessionId, userId);
  await clearGracePeriod(sessionId, userId);
  await updateParticipantPresence(sessionId, userId, {
    status: 'left',
    socketId: undefined,
    disconnectedAt: leftAt,
  });

  emitParticipantStatus(
    namespace,
    sessionId,
    {
      sessionId,
      userId,
      status: 'left',
      reason: 'left',
      at: leftAt,
    },
    socket.id,
  );

  const sessionEnded = await endSessionIfComplete(namespace, sessionId);
  if (sessionEnded) {
    socket.emit('session:ended', {
      sessionId,
      reason: 'all-participants-left',
      endedAt: new Date().toISOString(),
    });
  }

  socket.disconnect(true);
}

async function handleUnexpectedDisconnect(
  namespace: SessionNamespace,
  socket: AuthenticatedSessionSocket,
  reason: string,
): Promise<void> {
  const userId = socket.data.userId;
  const sessionId = socket.data.sessionId;
  if (!userId || !sessionId) {
    return;
  }

  const [session, participants] = await Promise.all([
    getSession(sessionId),
    getParticipants(sessionId),
  ]);
  if (!session || !participants) {
    return;
  }

  const participant = participants.find((entry) => entry.userId === userId);
  if (
    !shouldHandleUnexpectedDisconnect({
      explicitLeave: socket.data.explicitLeave ?? false,
      superseded: socket.data.superseded ?? false,
      participant,
      socketId: socket.id,
    })
  ) {
    return;
  }

  const disconnectedAt = new Date().toISOString();
  const graceRecord = {
    sessionId,
    userId,
    createdAt: disconnectedAt,
    expiresAt: new Date(Date.now() + session.gracePeriodMs).toISOString(),
  };

  await updateParticipantPresence(sessionId, userId, {
    status: 'disconnected',
    socketId: undefined,
    disconnectedAt,
  });
  await saveGracePeriod(graceRecord);
  scheduleGraceExpiry(namespace, sessionId, userId, session.gracePeriodMs);

  emitParticipantStatus(namespace, sessionId, {
    sessionId,
    userId,
    status: 'disconnected',
    reason: 'temporarily-disconnected',
    at: disconnectedAt,
  });

  logger.info(`Session socket disconnected: ${socket.id}`, reason);
}

export function configureSessionNamespace(namespace: SessionNamespace): void {
  namespace.use(async (socket, next) => {
    try {
      const sessionSocket = socket as AuthenticatedSessionSocket;
      const accessToken = getBearerToken(sessionSocket);
      const sessionId = getHandshakeString(sessionSocket.handshake.auth?.sessionId);
      const joinToken = getHandshakeString(sessionSocket.handshake.auth?.joinToken);
      const nowIso = new Date().toISOString();

      if (!accessToken || !sessionId || !joinToken) {
        return next(new Error('MISSING_SESSION_AUTH'));
      }

      const user = await getSupabaseUser(accessToken);
      if (!user) {
        return next(new Error('INVALID_ACCESS_TOKEN'));
      }

      const [session, participants, storedJoinToken] = await Promise.all([
        getSession(sessionId),
        getParticipants(sessionId),
        getStoredJoinToken(sessionId, user.id),
      ]);

      const failureCode = resolveParticipantJoinFailureCode({
        sessionId,
        userId: user.id,
        joinToken,
        nowIso,
        session,
        participants,
        storedJoinToken,
        hashJoinToken,
      });
      if (failureCode) {
        return next(new Error(failureCode));
      }

      const participant = participants!.find((entry) => entry.userId === user.id)!;
      const connectedAt = new Date().toISOString();
      clearScheduledGraceTimeout(sessionId, user.id);
      await updateParticipantPresence(sessionId, user.id, {
        status: 'connected',
        socketId: socket.id,
        connectedAt,
        disconnectedAt: undefined,
      });
      await clearGracePeriod(sessionId, user.id);

      if (participant.socketId && participant.socketId !== socket.id) {
        disconnectSupersededSocket(namespace, participant.socketId, 'SESSION_SUPERSEDED');
      }

      sessionSocket.data.userId = user.id;
      sessionSocket.data.sessionId = sessionId;
      sessionSocket.data.previousStatus = participant.status;
      return next();
    } catch (error) {
      logger.error('Session socket authentication failed', error);
      return next(new Error('SESSION_AUTH_FAILED'));
    }
  });

  namespace.on('connection', async (socket: AuthenticatedSessionSocket) => {
    const userId = socket.data.userId;
    const sessionId = socket.data.sessionId;
    if (!userId || !sessionId) {
      socket.disconnect(true);
      return;
    }

    joinSessionRoom(socket, sessionId);

    const [session, participants] = await Promise.all([
      updateSessionStatus(sessionId, 'active'),
      getParticipants(sessionId),
    ]);

    const joinedPayload: SessionJoinedPayload = {
      sessionId,
      userId,
      participantIds: participants?.map((participant) => participant.userId) ?? [],
      language: session?.language ?? '',
      status: session?.status ?? 'active',
    };

    socket.emit('session:joined', joinedPayload);
    emitDocumentSync(socket, await getDocumentSyncPayload(sessionId));
    emitParticipantStatus(
      namespace,
      sessionId,
      {
        sessionId,
        userId,
        status: 'connected',
        reason: getParticipantConnectedReason(socket.data.previousStatus),
        at: new Date().toISOString(),
      },
      socket.id,
    );
    logger.info(
      `Session socket connected: ${socket.id} for user ${userId} in session ${sessionId}`,
    );

    socket.on('doc:update', async (payload: SessionDocumentUpdatePayload) => {
      try {
        if (!payload?.update) {
          socket.emit('session:error', { message: 'Missing document update payload' });
          return;
        }

        const documentUpdate = await applyDocumentUpdate(sessionId, payload.update);

        emitDocumentUpdateToPeers(namespace, sessionId, socket.id, {
          ...documentUpdate,
          userId,
        });
      } catch (error) {
        logger.error(`Failed to apply Yjs update for session ${sessionId}`, error);
        socket.emit('session:error', { message: 'Failed to apply document update' });
      }
    });

    socket.on('session:leave', async () => {
      try {
        await handleParticipantLeave(namespace, socket);
      } catch (error) {
        logger.error(`Failed to process session leave for ${sessionId}`, error);
        socket.emit('session:error', { message: 'Failed to leave session' });
      }
    });

    socket.on('disconnect', (reason: string) => {
      void handleUnexpectedDisconnect(namespace, socket, reason);
    });
  });
}
