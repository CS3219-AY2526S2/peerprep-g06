declare module 'amqplib' {
  export interface ConsumeMessage {
    content: Buffer;
    fields: Record<string, unknown>;
    properties: Record<string, unknown>;
  }

  export interface Channel {
    assertExchange(
      exchange: string,
      type: string,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
    assertQueue(queue: string, options?: Record<string, unknown>): Promise<unknown>;
    bindQueue(queue: string, exchange: string, pattern: string): Promise<unknown>;
    prefetch(count: number): Promise<unknown>;
    consume(
      queue: string,
      onMessage: (message: ConsumeMessage | null) => void | Promise<void>,
    ): Promise<unknown>;
    ack(message: ConsumeMessage): void;
    nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
    on(event: 'error' | 'close', listener: (error?: unknown) => void): this;
  }

  export interface ChannelModel {
    createChannel(): Promise<Channel>;
    on(event: 'error' | 'close', listener: (error?: unknown) => void): this;
  }

  export function connect(url: string): Promise<ChannelModel>;

  const amqp: {
    connect: typeof connect;
  };

  export default amqp;
}
