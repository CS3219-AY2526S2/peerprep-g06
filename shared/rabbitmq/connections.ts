import amqp, { ChannelModel, Channel } from 'amqplib';

let connection: ChannelModel | null;
let channel: Channel | null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

export async function getChannel(): Promise<Channel> {
    if (!connection) {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
    }
    if (!channel) throw new Error('Failed to create channel');
    return channel;
}

export async function closeConnection() {
    if (connection) {
        await connection.close();
        connection = null;
        channel = null;
    }
}