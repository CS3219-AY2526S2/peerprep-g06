import { Server, Socket } from 'socket.io';
import { Match, MatchStatus, Difficulty, MatchFoundPayload } from '../../../../shared/types';
import { DIFFICULTIES, LANGUAGES } from '../../../../shared/constants';
import { User } from '../types/user';
import {
  addUserToQueue,
  removeUserFromQueue,
  getUserRequest,
  getRequestTTL,
  deleteUserRequest,
  updateSocketId,
  getUserQueueKey,
  getUsersInQueue,
  releaseUserMatch,
} from '../services/queue';
import { findMatch } from '../services/matchmaking';
import { logger } from '../utils/logger';

function buildMatchFoundPayload(match: Match, recipientUserId: string): MatchFoundPayload {
  return {
    matchId: match.id,
    question: match.question,
    peerId: match.user1Id === recipientUserId ? match.user2Id : match.user1Id,
    difficulty: match.difficulty,
    topic: match.commonTopic,
    language: match.commonLanguage,
  };
}

function emitMatchFound(io: Server, match: Match): void {
  const payload1 = buildMatchFoundPayload(match, match.user1Id);
  const payload2 = buildMatchFoundPayload(match, match.user2Id);
  io.to(match.user1Id).emit('match_found', payload1);
  io.to(match.user2Id).emit('match_found', payload2);
}

export function registerHandlers(io: Server, socket: Socket): void {
  socket.on(
    'join_queue',
    async (data: { userId: string; difficulty: string; topics: string[]; language: string }) => {
      try {
        const { userId, difficulty, topics, language } = data;

        // validate payload
        if (!userId || !difficulty || !topics || !language) {
          socket.emit('queue_error', {
            message: 'Missing required fields: userId, difficulty, topics, language',
          });
          return;
        }

        // unconditionally join the Socket.io room for this userId
        socket.join(userId);
        logger.info(`Socket ${socket.id} joined room ${userId}`);

        // reconnection check: is this user already in the queue?
        const existingRequest = await getUserRequest(userId);
        if (existingRequest && existingRequest.status === MatchStatus.PENDING) {
          // reconnect: update socketId, send remaining TTL
          await updateSocketId(userId, socket.id);
          const timeLeft = await getRequestTTL(userId);
          socket.emit('queue_rejoined', { timeLeft: timeLeft > 0 ? timeLeft : 0 });
          logger.info(`User ${userId} reconnected to queue, ${timeLeft}s remaining`);
          return;
        }

        // fresh join: create user and add to queue
        const user: User = {
          id: userId,
          socketId: socket.id,
          difficulty: difficulty as Difficulty,
          topics,
          language,
          joinedAt: new Date(),
          status: MatchStatus.PENDING,
        };

        await addUserToQueue(user);
        logger.info(`User ${userId} added to queue ${difficulty}:${language}`);

        // eager match attempt
        const match = await findMatch(user);
        if (match) {
          emitMatchFound(io, match);
        }
      } catch (error) {
        logger.error(`Error in join_queue handler:`, error);
        socket.emit('queue_error', { message: 'Internal server error while joining queue' });
      }
    },
  );

  socket.on('cancel_queue', async (data: { userId: string }) => {
    try {
      const { userId } = data;
      if (!userId) return;

      const queueKey = await getUserQueueKey(userId);

      if (queueKey) {
        await removeUserFromQueue(userId, queueKey);
        await deleteUserRequest(userId);
        logger.info(`User ${userId} cancelled and removed from queue`);
      }

      await releaseUserMatch(userId);
    } catch (error) {
      logger.error(`Error in cancel_queue handler:`, error);
    }
  });

  socket.on('disconnect', () => {
    // intentional no-op: 30s Redis TTL handles cleanup for unexpected disconnects
    logger.info(`Socket ${socket.id} disconnected`);
  });
}

export function startMatchmakingInterval(io: Server): NodeJS.Timeout {
  const INTERVAL_MS = 5000;

  const intervalId = setInterval(async () => {
    try {
      for (const diff of DIFFICULTIES) {
        for (const lang of LANGUAGES) {
          const users = await getUsersInQueue(diff.id, lang.id);
          const pendingUsers = users.filter((u) => u.status === MatchStatus.PENDING);

          for (const user of pendingUsers) {
            const match = await findMatch(user);
            if (match) {
              emitMatchFound(io, match);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error in matchmaking interval:', error);
    }
  }, INTERVAL_MS);

  logger.info(`Matchmaking interval started (every ${INTERVAL_MS / 1000}s)`);
  return intervalId;
}
