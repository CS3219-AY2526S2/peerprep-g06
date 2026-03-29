import amqp, { ChannelModel, Channel } from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
export const EXCHANGE_NAME = 'peerprep';

export async function setupTopicExchange() {
  // connect to rabbitmq
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  // declare topic exchange
  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  // declare and bind queues (extensible)
  const queues = [{ name: 'match', pattern: 'match.*' }];

  for (const queue of queues) {
    await channel.assertQueue(queue.name, { durable: true });
    await channel.bindQueue(queue.name, EXCHANGE_NAME, queue.pattern);
    console.log(
      `Queue ${queue.name} bound to exchange ${EXCHANGE_NAME} with pattern ${queue.pattern}`,
    );
  }
  return channel;
}

let topicExchange: Channel | null = null;

export async function getTopicExchange() {
  if (topicExchange === null) {
    topicExchange = await setupTopicExchange();
  }
  return topicExchange;
}
