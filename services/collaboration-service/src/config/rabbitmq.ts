import amqp from 'amqplib';
import { config } from './env';
import { logger } from '../utils/logger';

let connection: any = null;
let channel: any = null;

export async function connectRabbitMq(): Promise<{ connection: any; channel: any }> {
  if (connection && channel) {
    return { connection, channel };
  }

  connection = await amqp.connect(config.rabbitmq.url);
  channel = await connection.createChannel();

  logger.info('RabbitMQ connection established');

  return { connection, channel };
}
