import { getTopicExchange } from './connections';


export async function publishEvent(event: string, result: string, data: Record<string, unknown>) {
    const channel = await getTopicExchange();

    const routingKey = `${event}.${result}`;

    const message = {
        event,
        data,
        timestamp: Date.now(),
    };

    channel.publish(
        'peerprep',
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
            persistent: true,
        },
    )
    
    console.log(`Event ${event} published to match exchange`, message);
}
