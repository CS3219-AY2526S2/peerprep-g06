// Shared RabbitMQ connection helper.
// The service opens one connection/channel pair, re-registers consumers after reconnect,
// and keeps the rest of the service from silently losing its RabbitMQ subscriptions.
import amqp from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import { config } from './env';
import { logger } from '../utils/logger';

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
let connectInFlight: Promise<{ connection: ChannelModel; channel: Channel }> | null = null;
let consumerSetup: ((channel: Channel) => Promise<void>) | null = null;

function clearCachedHandles(
  closedConnection?: ChannelModel | null,
  closedChannel?: Channel | null,
): void {
  if (!closedConnection || connection === closedConnection) {
    connection = null;
  }

  if (!closedChannel || channel === closedChannel) {
    channel = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimeout || connectInFlight) {
    return;
  }

  const delayMs = reconnectDelayMs;
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    void connectRabbitMq().catch((error) => {
      logger.error('RabbitMQ reconnect failed', error);
      scheduleReconnect();
    });
  }, delayMs);
}

async function setupConsumer(activeChannel: Channel): Promise<void> {
  if (!consumerSetup) {
    return;
  }
  await consumerSetup(activeChannel);
}

function attachLifecycleHandlers(activeConnection: ChannelModel, activeChannel: Channel): void {
  activeConnection.on('error', (error: unknown) => {
    logger.error('RabbitMQ connection error', error);
  });
  activeConnection.on('close', () => {
    logger.warn('RabbitMQ connection closed');
    clearCachedHandles(activeConnection, activeChannel);
    scheduleReconnect();
  });

  activeChannel.on('error', (error: unknown) => {
    logger.error('RabbitMQ channel error', error);
  });
  activeChannel.on('close', () => {
    logger.warn('RabbitMQ channel closed');
    clearCachedHandles(activeConnection, activeChannel);
    scheduleReconnect();
  });
}

export async function connectRabbitMq(
  registerConsumer?: (channel: Channel) => Promise<void>,
): Promise<{ connection: ChannelModel; channel: Channel }> {
  if (registerConsumer) {
    consumerSetup = registerConsumer;
  }

  if (connection && channel) {
    if (registerConsumer) {
      await setupConsumer(channel);
    }
    return { connection, channel };
  }

  if (connectInFlight) {
    return connectInFlight;
  }

  connectInFlight = (async () => {
    const activeConnection = await amqp.connect(config.rabbitmq.url);
    const activeChannel = await activeConnection.createChannel();

    attachLifecycleHandlers(activeConnection, activeChannel);

    connection = activeConnection;
    channel = activeChannel;
    reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;

    logger.info('RabbitMQ connection established');
    await setupConsumer(activeChannel);

    return { connection: activeConnection, channel: activeChannel };
  })();

  try {
    return await connectInFlight;
  } finally {
    connectInFlight = null;
  }
}
