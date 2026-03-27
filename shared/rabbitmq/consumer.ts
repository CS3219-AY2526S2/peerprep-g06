import { getTopicExchange } from './connections';

export async function consume(queue: string) {
    const channel = await getTopicExchange();

    // process one message at a time
    await channel.prefetch(1);

    console.log(`Waiting for messages on ${queue}...`);

    channel.consume(queue, (msg) => {
        if (msg !== null) {
            const message = JSON.parse(msg.content.toString());
            console.log(`Received message: ${message}`);

            // acknowledge message after processing
            channel.ack(msg);
        }
    });
}