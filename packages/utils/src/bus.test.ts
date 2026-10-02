import { describe, expect, it } from 'vitest';
import { encodeRedisCommand, MemoryStateBus } from './bus';

describe('state bus', () => {
  it('delivers a publish to subscribers on that channel', () => {
    const bus = new MemoryStateBus();
    const seen: string[] = [];
    bus.subscribe('state', (payload) => seen.push(payload));
    bus.publish('state', '{"entityId":"api"}');
    bus.publish('other', 'nope');
    expect(seen).toEqual(['{"entityId":"api"}']);
  });

  it('encodes a Redis PUBLISH command', () => {
    expect(encodeRedisCommand(['PUBLISH', 'state', 'hi'])).toBe('*3\r\n$7\r\nPUBLISH\r\n$5\r\nstate\r\n$2\r\nhi\r\n');
  });
});
