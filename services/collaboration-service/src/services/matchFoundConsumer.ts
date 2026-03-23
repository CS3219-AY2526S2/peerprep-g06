import { config } from '../config/env';
import { MatchFoundEvent } from '../types/contracts';
import { createSessionFromMatchFound } from './sessionStore';
import { logger } from '../utils/logger';

function parseMatchFoundEvent(content: Buffer): MatchFoundEvent {
  const parsed = JSON.parse(content.toString()) as MatchFoundEvent;

  if (
    parsed.eventVersion !== 1 ||
    !parsed.matchId ||
    !parsed.user1Id ||
    !parsed.user2Id ||
    !parsed.language ||
    !parsed.question
  ) {
    throw new Error('Invalid MatchFound payload');
  }

  return parsed;
}

export async function startMatchFoundConsumer(channel: any): Promise<void> {
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
