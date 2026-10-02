import { describe, expect, it } from 'vitest';
import { bindStateBus, prometheusText } from './bind';
import { StreamEngine } from './engine';

describe('stream binding', () => {
  it('turns a published state change into a diff and exposes prometheus text', () => {
    const engine = new StreamEngine({ coalesceMs: 0 });
    const handlers: ((payload: string) => void)[] = [];
    bindStateBus({ subscribe: (_channel, handler) => handlers.push(handler) }, engine, 'dash', () => 0);
    handlers[0]?.(JSON.stringify({ lane: 'NORMAL', state: { entityId: 'api', latency: 1 } }));
    handlers[0]?.(JSON.stringify({ lane: 'HIGH', state: { entityId: 'api', latency: 9, status: 'alert' } }));
    engine.flush('dash', 100);
    const text = prometheusText(engine.metrics);
    expect(text).toContain('livescope_stream_queue_depth');
    expect(engine.queue('dash').some((item) => item.type === 'ALERT')).toBe(true);
  });
});
