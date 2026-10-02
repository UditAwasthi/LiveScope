import { describe, expect, it } from 'vitest';
import { LiveScopeClient, grpcTransport } from '@livescope/sdk';
import { CircuitBreaker } from '@livescope/utils';
import type { ProducedRecord } from './ingest';
import { startGateway } from './server';

describe('gateway grpc', () => {
  it('accepts an SDK metric over BatchEvents and keys it by entityId', async () => {
    const records: ProducedRecord[] = [];
    const servers = await startGateway(
      {
        producer: {
          async send(record) {
            records.push(record);
          },
        },
        breaker: new CircuitBreaker({ failureThreshold: 3, resetMs: 1000 }),
        encode: (event) => Buffer.from(JSON.stringify(event)),
      },
      { httpPort: 0, grpcPort: 0 },
    );
    const client = new LiveScopeClient({
      nodeId: 'sdk-1',
      service: 'checkout',
      transport: grpcTransport(`127.0.0.1:${servers.grpcPort}`),
      flushMs: 60_000,
    });
    client.metric('latency', 12, {});
    await client.flush();
    await servers.close();
    expect(records[0]?.topic).toBe('metrics.raw');
    expect(records[0]?.key).toBe('checkout');
    const stored = JSON.parse(records[0]!.value.toString()) as { entityId: string; payload: { value: number } };
    expect(stored.entityId).toBe('checkout');
    expect(stored.payload.value).toBe(12);
  });
});
