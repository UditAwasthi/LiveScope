import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '@livescope/utils';
import { GATEWAY_CLIENT_ID } from './index';
import { ingest, otlpJsonToEvents, type ProducedRecord } from './ingest';

describe('gateway', () => {
  it('exports its client id', () => {
    expect(GATEWAY_CLIENT_ID).toBe('livescope-gateway');
  });

  it('acks a metric keyed by entityId and sends malformed events to the DLQ', async () => {
    const records: ProducedRecord[] = [];
    const deps = {
      producer: { async send(record: ProducedRecord) { records.push(record); } },
      breaker: new CircuitBreaker({ failureThreshold: 5, resetMs: 1000 }),
      encode: async (event: unknown) => Buffer.from(JSON.stringify(event)),
    };
    const ack = await ingest({
      id: 'e1',
      type: 'METRIC_RECORDED',
      entity: 'service',
      entityId: 'checkout',
      timestamp: 10,
      vectorClock: { n: 1 },
      payload: { metricName: 'latency', value: 8, tags: {} },
    }, deps);
    expect(ack).toMatchObject({ status: 'ack', topic: 'metrics.raw' });
    expect(records[0]?.key).toBe('checkout');

    const dlq = await ingest({ type: 'NOPE' }, deps);
    expect(dlq.status).toBe('dlq');
    expect(records.at(-1)?.topic).toBe('events.dlq');
  });

  it('maps an OTLP JSON gauge into a metric event', () => {
    const events = otlpJsonToEvents({
      resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: 'latency', gauge: { dataPoints: [{ asDouble: 12 }] } }] }] }],
    });
    expect(events[0]).toMatchObject({ type: 'METRIC_RECORDED', payload: { metricName: 'latency', value: 12 } });
  });

  it('rejects fast when the breaker is open', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetMs: 60_000 });
    await expect(breaker.exec(async () => { throw new Error('kafka down'); })).rejects.toThrow('kafka down');
    const result = ingest({ id: 'e', type: 'METRIC_RECORDED' }, {
      producer: { async send() { throw new Error('should not send'); } },
      breaker,
      encode: () => Buffer.from('x'),
    });
    await expect(result).rejects.toThrow(/circuit open/);
  });
});
