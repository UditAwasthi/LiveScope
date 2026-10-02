import { describe, expect, it } from 'vitest';
import { StreamEngine } from './engine';
import { SERVICE } from './index';

describe('stream-engine', () => {
  it('exports its service name', () => {
    expect(SERVICE).toBe('stream-engine');
  });

  it('coalesces normal diffs and never drops a high-lane alert', () => {
    const engine = new StreamEngine({ coalesceMs: 50, maxQueue: 1 });
    engine.push('sock', 'api', { latency: 1 }, { latency: 2 }, 'NORMAL', 0);
    engine.push('sock', 'api', { latency: 2 }, { latency: 3 }, 'NORMAL', 10);
    expect(engine.metrics.coalesced).toBe(1);
    engine.push('sock', 'api', {}, { alert: 'down' }, 'HIGH', 10);
    expect(engine.queue('sock').some((event) => event.type === 'ALERT')).toBe(true);
    const batch = Array.from({ length: 40 }, (_, index) => ({
      type: 'PATCH' as const,
      entity: 'service',
      id: `s${index}`,
      changes: { blob: 'x'.repeat(80) },
    }));
    expect(engine.encodeBatch(batch).codec).toBe('deflate');
  });
});
