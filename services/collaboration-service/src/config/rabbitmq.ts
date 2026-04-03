// Shared RabbitMQ connection helper.
// The service opens one connection/channel pair, re-registers consumers after reconnect,
// and keeps the rest of the service from silently losing its RabbitMQ subscriptions.
import amqp from 'amqplib';
import { config } from './env';
import { logger } from '../utils/logger';

let connection: any = null;
let channel: any = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let connectInFlight: Promise<{ connection: any; channel: any }> | null = null;
const consumerRegistrations = new Set<(channel: any) => Promise<void>>();

function clearCachedHandles(closedConnection?: any, closedChannel?: any): void {
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

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    void connectRabbitMq().catch((error) => {
      logger.error('RabbitMQ reconnect failed', error);
      scheduleReconnect();
    });
  }, 1000);
}

async function registerConsumers(activeChannel: any): Promise<void> {
  for (const registerConsumer of consumerRegistrations) {
    await registerConsumer(activeChannel);
  }
}

function attachLifecycleHandlers(activeConnection: any, activeChannel: any): void {
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

export async function registerRabbitMqConsumer(
  registerConsumer: (channel: any) => Promise<void>,
): Promise<void> {
  consumerRegistrations.add(registerConsumer);

  if (channel) {
    await registerConsumer(channel);
  }
}

export async function connectRabbitMq(): Promise<{ connection: any; channel: any }> {
  if (connection && channel) {
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

    logger.info('RabbitMQ connection established');
    await registerConsumers(activeChannel);

    return { connection: activeConnection, channel: activeChannel };
  })();

  try {
    return await connectInFlight;
  } finally {
    connectInFlight = null;
  }
}
