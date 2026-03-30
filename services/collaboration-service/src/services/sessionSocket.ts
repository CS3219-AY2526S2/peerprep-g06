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
  if (!participants || participants.some((participant) => participant.status !== 'left')) {
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
  if (socket.data.explicitLeave) {
    return;
  }

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
  if (!participant || participant.socketId !== socket.id || participant.status === 'left') {
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

      if (!accessToken || !sessionId || !joinToken) {
        return next(new Error('Missing session authentication details'));
      }

      const user = await getSupabaseUser(accessToken);
      if (!user) {
        return next(new Error('Invalid access token'));
      }

      const [session, participants, storedJoinToken] = await Promise.all([
        getSession(sessionId),
        getParticipants(sessionId),
        getStoredJoinToken(sessionId, user.id),
      ]);

      if (!session || !participants || !storedJoinToken) {
        return next(new Error('Session not found'));
      }

      if (session.status === 'ended') {
        return next(new Error('Session has already ended'));
      }

      const participant = participants.find((entry) => entry.userId === user.id);
      if (!participant) {
        return next(new Error('User is not a participant in this session'));
      }

      if (participant.status === 'left') {
        return next(new Error('User has already left this session'));
      }

      if (
        storedJoinToken.claims.sessionId !== sessionId ||
        storedJoinToken.claims.userId !== user.id ||
        storedJoinToken.claims.expiresAt <= new Date().toISOString()
      ) {
        return next(new Error('Join token is invalid or expired'));
      }

      if (hashJoinToken(joinToken) !== storedJoinToken.tokenHash) {
        return next(new Error('Join token does not match this session'));
      }

      transport.disconnectSocket(participant.socketId);

      const connectedAt = new Date().toISOString();
      clearScheduledGraceTimeout(sessionId, user.id);
      await updateParticipantPresence(sessionId, user.id, {
        status: 'connected',
        socketId: socket.id,
        connectedAt,
        disconnectedAt: undefined,
      });
      await clearGracePeriod(sessionId, user.id);

      socket.data.userId = user.id;
      socket.data.sessionId = sessionId;
      socket.data.previousStatus = participant.status;
      return next();
    } catch (error) {
      logger.error('Session socket authentication failed', error);
      return next(new Error('Session authentication failed'));
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

    const joinedPayload: SessionJoinedPayload = {
      sessionId,
      userId,
      participantIds: participants?.map((participant) => participant.userId) ?? [],
      language: session?.language ?? '',
      status: session?.status ?? 'active',
    };

    socket.emit('session:joined', joinedPayload);
    transport.emitDocumentSync(socket, await getDocumentSyncPayload(sessionId));
    transport.emitParticipantStatus(
      sessionId,
      {
        sessionId,
        userId,
        status: 'connected',
        reason: socket.data.previousStatus === 'disconnected' ? 'reconnected' : 'joined',
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
