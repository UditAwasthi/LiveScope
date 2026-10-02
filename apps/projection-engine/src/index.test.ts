import { describe, expect, it } from 'vitest';
import type { LiveScopeEvent } from '@livescope/event-schemas';
import { ProjectionEngine } from './engine';
import { SERVICE, VERSION } from './index';

function metric(id: string, clock: Record<string, number>, value: number, timestamp: number): LiveScopeEvent {
  return {
    id,
    type: 'METRIC_RECORDED',
    entity: 'service',
    entityId: 'api',
    timestamp,
    vectorClock: clock,
    orgId: 'local',
    projectId: 'default',
    environment: 'dev',
    region: 'us',
    payload: { metricName: 'errors', value, tags: { version: 'v2', status: 'up' } },
  };
}

describe('projection-engine', () => {
  it('exports its service name', () => {
    expect(SERVICE).toBe('projection-engine');
    expect(VERSION).toBe('1.0.0');
  });

  it('drops a causally old duplicate and keeps the counter after recovery', () => {
    const engine = new ProjectionEngine();
    const scope = { orgId: 'local', projectId: 'default', environment: 'dev' };
    engine.ingest(metric('a', { n: 1 }, 1, 10));
    engine.ingest(metric('b', { n: 1 }, 5, 11));
    engine.ingest(metric('c', { n: 2 }, 2, 12));
    engine.snapshotNow();
    engine.ingest(metric('d', { n: 3 }, 3, 20));
    const before = engine.get(scope, 'api');
    engine.crashAndRecover();
    const after = engine.get(scope, 'api');
    expect(after?.errorCount).toEqual(before?.errorCount);
    expect(after?.metrics.errors).toBe(3);
    expect(engine.at(scope, 'api', 12)?.metrics.errors).toBe(2);
  });

  it('hides another tenant', () => {
    const engine = new ProjectionEngine();
    engine.ingest(metric('a', { n: 1 }, 1, 10));
    expect(engine.catalog({ orgId: 'other', projectId: 'default', environment: 'dev' })).toHaveLength(0);
  });
});
