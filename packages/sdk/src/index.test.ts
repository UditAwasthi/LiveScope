import { describe, expect, it } from 'vitest';
import type { LiveScopeEvent } from '@livescope/event-schemas';
import { LiveScopeClient, reconnectingTransport, type Transport } from './client';
import { VERSION } from './index';

describe('@livescope/sdk', () => {
  it('exports a version', () => {
    expect(VERSION).toBe('1.0.0');
  });

  it('flushes a metric with a ticked vector clock', async () => {
    const batches: LiveScopeEvent[][] = [];
    const transport: Transport = { async send(events) { batches.push(events); } };
    const client = new LiveScopeClient({ nodeId: 'sdk-1', transport, service: 'checkout', flushCount: 100 });
    client.metric('latency', 12, { route: '/pay' });
    client.trace('checkout').tag('region', 'us').end();
    await client.flush();
    expect(batches).toHaveLength(1);
    expect(batches[0]?.[0]).toMatchObject({
      type: 'METRIC_RECORDED',
      entityId: 'checkout',
      payload: { metricName: 'latency', value: 12 },
      vectorClock: { 'sdk-1': 1 },
    });
    expect(batches[0]?.[1]?.type).toBe('SPAN_ENDED');
  });

  it('auto-flushes when the buffer reaches the count', async () => {
    const batches: LiveScopeEvent[][] = [];
    const transport: Transport = { async send(events) { batches.push(events); } };
    const client = new LiveScopeClient({ nodeId: 'sdk-1', transport, flushCount: 1, flushMs: 60_000 });
    client.log('info', 'hello');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(batches).toHaveLength(1);
    await client.close();
  });

  it('retries a failed flush before succeeding', async () => {
    let attempts = 0;
    const transport = reconnectingTransport(
      {
        async send() {
          attempts += 1;
          if (attempts < 3) throw new Error('down');
        },
      },
      [1, 1, 1],
    );
    await transport.send([]);
    expect(attempts).toBe(3);
  });
});
