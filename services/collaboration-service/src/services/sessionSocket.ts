// Socket.IO namespace for authenticated session joins.
// This only admits the two users associated with a session and prepares the room for later realtime editing.
import { Namespace } from 'socket.io';
import { getSupabaseUser } from '../lib/supabase';
import {
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  ParticipantStatusPayload,
  SessionEndedPayload,
  SessionDocumentUpdatePayload,
  SessionJoinedPayload,
} from '../types/contracts';
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
  getDocumentSyncPayload,
} from './documentSyncService';
import { SessionTransport } from './realtimeTransport';
import { logger } from '../utils/logger';
import { StoredJoinToken } from '../types/session';
import {
  getParticipantConnectedReason,
  getParticipantStatusSnapshotReason,
  isSessionComplete,
  resolveParticipantJoinFailureCode,
  shouldHandleUnexpectedDisconnect,
} from './sessionLifecycle';

type SessionNamespace = Namespace<
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents
>;

const graceTimeouts = new Map<string, NodeJS.Timeout>();

function getGraceTimeoutKey(sessionId: string, userId: string): string {
  return `${sessionId}:${userId}`;
}

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

async function cleanupEndedSession(transport: SessionTransport, sessionId: string): Promise<void> {
  const endedAt = new Date().toISOString();
  const endedPayload: SessionEndedPayload = {
    sessionId,
    reason: 'all-participants-left',
    endedAt,
  };

  await updateSessionStatus(sessionId, 'ended');
  transport.emitSessionEnded(sessionId, endedPayload);
  await disposeDocument(sessionId);
  await deleteSessionState(sessionId);
}

async function endSessionIfComplete(
  transport: SessionTransport,
  sessionId: string,
): Promise<boolean> {
  const participants = await getParticipants(sessionId);
  if (!isSessionComplete(participants)) {
    return false;
  }

  await cleanupEndedSession(transport, sessionId);
  return true;
}

function scheduleGraceExpiry(
  transport: SessionTransport,
  sessionId: string,
  userId: string,
  gracePeriodMs: number,
): void {
  clearScheduledGraceTimeout(sessionId, userId);

  const timeoutKey = getGraceTimeoutKey(sessionId, userId);
  const timeout = setTimeout(() => {
    void handleGraceExpiry(transport, sessionId, userId);
  }, gracePeriodMs);

  graceTimeouts.set(timeoutKey, timeout);
}

async function handleGraceExpiry(
  transport: SessionTransport,
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
      transport,
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

  transport.emitParticipantStatus(sessionId, {
    sessionId,
    userId,
    status: 'left',
    reason: 'grace-expired',
    at: leftAt,
  });

  await endSessionIfComplete(transport, sessionId);
}

export async function recoverScheduledGracePeriods(transport: SessionTransport): Promise<void> {
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
      await handleGraceExpiry(transport, gracePeriod.sessionId, gracePeriod.userId);
      continue;
    }

    scheduleGraceExpiry(transport, gracePeriod.sessionId, gracePeriod.userId, remainingMs);
    scheduledCount += 1;
  }

  logger.info(`Recovered ${scheduledCount} active grace-period timers`);
}

async function handleParticipantLeave(transport: SessionTransport, socket: any): Promise<void> {
  if (socket.data.leaveHandled) {
    return;
  }

  socket.data.leaveHandled = true;
  socket.data.explicitLeave = true;

  const userId = socket.data.userId as string;
  const sessionId = socket.data.sessionId as string;
  const leftAt = new Date().toISOString();

  clearScheduledGraceTimeout(sessionId, userId);
  await clearGracePeriod(sessionId, userId);
  await updateParticipantPresence(sessionId, userId, {
    status: 'left',
    socketId: undefined,
    disconnectedAt: leftAt,
  });

  transport.emitParticipantStatus(
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

  const sessionEnded = await endSessionIfComplete(transport, sessionId);
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
  transport: SessionTransport,
  socket: any,
  reason: string,
): Promise<void> {
  const userId = socket.data.userId as string;
  const sessionId = socket.data.sessionId as string;
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
      explicitLeave: Boolean(socket.data.explicitLeave),
      superseded: Boolean(socket.data.superseded),
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
  scheduleGraceExpiry(transport, sessionId, userId, session.gracePeriodMs);

  transport.emitParticipantStatus(sessionId, {
    sessionId,
    userId,
    status: 'disconnected',
    reason: 'temporarily-disconnected',
    at: disconnectedAt,
  });

  logger.info(`Session socket disconnected: ${socket.id}`, reason);
}

export function configureSessionNamespace(
  namespace: SessionNamespace,
  transport: SessionTransport,
): void {
  namespace.use(async (socket, next) => {
    try {
      const accessToken = getBearerToken(socket);
      const sessionId = getHandshakeString(socket.handshake.auth?.sessionId);
      const joinToken = getHandshakeString(socket.handshake.auth?.joinToken);
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

      const joinFailureCode = resolveParticipantJoinFailureCode({
        sessionId,
        userId: user.id,
        joinToken,
        nowIso,
        session,
        participants,
        storedJoinToken,
        hashJoinToken,
      });

      if (joinFailureCode) {
        return next(new Error(joinFailureCode));
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
        transport.disconnectSocket(participant.socketId, 'SESSION_SUPERSEDED');
      }

      socket.data.userId = user.id;
      socket.data.sessionId = sessionId;
      socket.data.previousStatus = participant.status;
      return next();
    } catch (error) {
      logger.error('Session socket authentication failed', error);
      return next(new Error('SESSION_AUTH_FAILED'));
    }
  });

  namespace.on('connection', async (socket: any) => {
    const userId = socket.data.userId as string;
    const sessionId = socket.data.sessionId as string;

    transport.joinSessionRoom(socket, sessionId);

    const [session, participants] = await Promise.all([
      updateSessionStatus(sessionId, 'active'),
      getParticipants(sessionId),
    ]);

    if (!socket.connected) {
      return;
    }

    const activeParticipant = participants?.find((participant) => participant.userId === userId);
    if (
      !activeParticipant ||
      activeParticipant.status !== 'connected' ||
      activeParticipant.socketId !== socket.id
    ) {
      return;
    }

    const joinedPayload: SessionJoinedPayload = {
      sessionId,
      userId,
      participantIds: participants?.map((participant) => participant.userId) ?? [],
      language: session?.language ?? '',
      status: session?.status ?? 'active',
    };

    socket.emit('session:joined', joinedPayload);
    transport.emitDocumentSync(socket, await getDocumentSyncPayload(sessionId));
    for (const participant of participants ?? []) {
      socket.emit('participant:status', {
        sessionId,
        userId: participant.userId,
        status: participant.status,
        reason: getParticipantStatusSnapshotReason(participant),
        at: participant.disconnectedAt ?? participant.connectedAt ?? new Date().toISOString(),
      });
    }
    transport.emitParticipantStatus(
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

        transport.emitDocumentUpdateToPeers(sessionId, socket.id, {
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
        await handleParticipantLeave(transport, socket);
      } catch (error) {
        logger.error(`Failed to process session leave for ${sessionId}`, error);
        socket.emit('session:error', { message: 'Failed to leave session' });
      }
    });

    socket.on('disconnect', (reason: string) => {
      void handleUnexpectedDisconnect(transport, socket, reason);
    });
  });
}
