// Socket.IO namespace for authenticated session joins.
// This only admits the two users associated with a session and prepares the room for later realtime editing.
import { Namespace } from 'socket.io';
import { getSupabaseUser } from '../lib/supabase';
import {
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents,
  SessionJoinedPayload,
} from '../types/contracts';
import {
  clearGracePeriod,
  getParticipants,
  getSession,
  getStoredJoinToken,
  hashJoinToken,
  updateParticipantPresence,
  updateSessionStatus,
} from './sessionPersistence';
import { logger } from '../utils/logger';

type SessionNamespace = Namespace<
  CollaborationSessionSocketClientToServerEvents,
  CollaborationSessionSocketServerToClientEvents
>;

const SESSION_ROOM_PREFIX = 'session:';

function getSessionRoom(sessionId: string): string {
  return `${SESSION_ROOM_PREFIX}${sessionId}`;
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

async function disconnectStaleSessionSocket(namespace: SessionNamespace, socketId?: string): Promise<void> {
  if (!socketId) {
    return;
  }

  const staleSocket = namespace.sockets.get(socketId);
  if (staleSocket) {
    staleSocket.disconnect(true);
  }
}

export function configureSessionNamespace(namespace: SessionNamespace): void {
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

      const participant = participants.find((entry) => entry.userId === user.id);
      if (!participant) {
        return next(new Error('User is not a participant in this session'));
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

      await disconnectStaleSessionSocket(namespace, participant.socketId);

      const connectedAt = new Date().toISOString();
      await updateParticipantPresence(sessionId, user.id, {
        status: 'connected',
        socketId: socket.id,
        connectedAt,
        disconnectedAt: undefined,
      });
      await clearGracePeriod(sessionId, user.id);

      socket.data.userId = user.id;
      socket.data.sessionId = sessionId;
      return next();
    } catch (error) {
      logger.error('Session socket authentication failed', error);
      return next(new Error('Session authentication failed'));
    }
  });

  namespace.on('connection', async (socket: any) => {
    const userId = socket.data.userId as string;
    const sessionId = socket.data.sessionId as string;

    socket.join(getSessionRoom(sessionId));

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
    logger.info(`Session socket connected: ${socket.id} for user ${userId} in session ${sessionId}`);

    socket.on('disconnect', (reason: string) => {
      logger.info(`Session socket disconnected: ${socket.id}`, reason);
    });
  });
}
