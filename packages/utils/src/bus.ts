export interface StateBus {
  publish(channel: string, payload: string): void;
  subscribe(channel: string, handler: (payload: string) => void): void;
}

export const FANOUT_CHANNEL = 'livescope.fanout';

export class MemoryStateBus implements StateBus {
  private readonly handlers = new Map<string, Set<(payload: string) => void>>();

  publish(channel: string, payload: string): void {
    for (const handler of this.handlers.get(channel) ?? []) handler(payload);
  }

  subscribe(channel: string, handler: (payload: string) => void): void {
    const set = this.handlers.get(channel) ?? new Set();
    set.add(handler);
    this.handlers.set(channel, set);
  }
}

/** RESP array encoding for a Redis command. */
export function encodeRedisCommand(args: string[]): string {
  const parts = [`*${args.length}`];
  for (const arg of args) {
    parts.push(`$${Buffer.byteLength(arg)}`);
    parts.push(arg);
  }
  return `${parts.join('\r\n')}\r\n`;
}

interface RedisLike {
  connect(): Promise<void>;
  publish(channel: string, payload: string): Promise<number>;
  subscribe(channel: string, handler: (message: string) => void): Promise<void>;
}

export async function connectRedisBus(url: string): Promise<StateBus> {
  const redis = (await import('redis')) as unknown as {
    createClient(options: { url: string }): RedisLike;
  };
  const publisher = redis.createClient({ url });
  const subscriber = redis.createClient({ url });
  await publisher.connect();
  await subscriber.connect();
  return {
    publish(channel, payload) {
      void publisher.publish(channel, payload);
    },
    subscribe(channel, handler) {
      void subscriber.subscribe(channel, handler);
    },
  };
}
