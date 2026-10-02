import { describe, expect, it } from 'vitest';
import type { LiveScopeEvent } from '@livescope/event-schemas';
import { ProjectionEngine, ProjectionLog } from './engine';
import { eventFromKafkaValue, insertEvent } from './store';

const event = {
  id: 'e1',
  type: 'METRIC_RECORDED',
  entity: 'service',
  entityId: 'api',
  timestamp: 10,
  vectorClock: { n: 1 },
  orgId: 'local',
  projectId: 'default',
  environment: 'dev',
  region: 'us',
  payload: { metricName: 'errors', value: 1, tags: { version: 'v1', status: 'up' } },
} as LiveScopeEvent;

describe('projection adapters', () => {
  it('publishes state and records an insert for the durable log', () => {
    const published: string[] = [];
    const rows: unknown[][] = [];
    const engine = new ProjectionEngine(
      new ProjectionLog((stored, offset) => {
        rows.push(insertEvent(stored, offset).params);
      }),
      { publish: (_channel, payload) => published.push(payload) },
    );
    engine.ingest(event);
    expect(JSON.parse(published[0] ?? '{}')).toMatchObject({ lane: 'NORMAL', state: { entityId: 'api' } });
    expect(rows[0]?.[1]).toBe('api');
    const encoded = eventFromKafkaValue(Buffer.from(JSON.stringify({ schemaId: 1, event })));
    expect(encoded?.id).toBe('e1');
  });
});
