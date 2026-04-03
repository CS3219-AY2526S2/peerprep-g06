// RabbitMQ consumer for match handoff events.
// It creates the session, queues session-ready notifications, and delivers them immediately if possible.
import { config } from '../config/env';
import { MatchFoundEvent } from '../types/contracts';
import { createSessionFromMatchFound } from './sessionStore';
import {
  createSessionReadyPayload,
  deliverSessionReadyIfConnected,
  queueSessionReadyNotification,
} from './notificationService';
import { NotificationTransport } from './realtimeTransport';
import { logger } from '../utils/logger';

interface MatchFoundEnvelope {
  event: string;
  data?: {
    matchFound?: MatchFoundEvent;
  };
  timestamp?: number;
}

export function parseMatchFoundEvent(content: Buffer): MatchFoundEvent {
  // Matching publishes a RabbitMQ event envelope when a pair is formed.
  const parsed = JSON.parse(content.toString()) as MatchFoundEnvelope;
  const event = parsed.data?.matchFound;

  if (
    parsed.event !== 'match' ||
    !event ||
    event.eventVersion !== 1 ||
    !event.matchId ||
    !event.user1Id ||
    !event.user2Id ||
    !event.language ||
    !event.question
  ) {
    throw new Error('Invalid MatchFound payload');
  }

  return event;
}

export async function startMatchFoundConsumer(
  channel: any,
  notificationTransport: NotificationTransport,
): Promise<void> {
  await channel.assertExchange(config.rabbitmq.matchFoundExchange, 'topic', {
    durable: true,
  });
  await channel.assertQueue(config.rabbitmq.matchFoundQueue, {
    durable: true,
  });
  await channel.bindQueue(
    config.rabbitmq.matchFoundQueue,
    config.rabbitmq.matchFoundExchange,
    config.rabbitmq.matchFoundRoutingKey,
  );
  await channel.prefetch(1);

  await channel.consume(config.rabbitmq.matchFoundQueue, async (message: any) => {
    if (!message) {
      return;
    }

    try {
      const event = parseMatchFoundEvent(message.content);
      const { sessionId, created } = await createSessionFromMatchFound(event);
      // Build one delivery payload per matched user from the data persisted during session creation.
      const sessionReadyPayloads = await Promise.all([
        createSessionReadyPayload(sessionId, event.user1Id),
        createSessionReadyPayload(sessionId, event.user2Id),
      ]);

      for (const payload of sessionReadyPayloads) {
        if (!payload) {
          throw new Error(`Failed to build session-ready payload for session ${sessionId}`);
        }
      }

      if (created) {
        // New sessions always queue the notification first so reconnect paths can replay it safely.
        for (const payload of sessionReadyPayloads) {
          await queueSessionReadyNotification(payload!);
        }
      }

      // If the user is already online on the notification socket, deliver immediately and clear the pending record.
      for (const payload of sessionReadyPayloads) {
        await deliverSessionReadyIfConnected(
          notificationTransport,
          payload!.userId,
          payload!.sessionId,
        );
      }

      logger.info(
        created
          ? `Created collaboration session ${sessionId} for match ${event.matchId}`
          : `Match ${event.matchId} already mapped to collaboration session ${sessionId}`,
      );

      channel.ack(message);
    } catch (error) {
      logger.error('Failed to process MatchFound event', error);
      channel.nack(message, false, false);
    }
  });

  logger.info(
    `Subscribed to MatchFound events on ${config.rabbitmq.matchFoundExchange}:${config.rabbitmq.matchFoundRoutingKey}`,
  );
}
