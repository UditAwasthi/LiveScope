import type { JsonObject } from '@livescope/diff-engine';
import type { Lane, StreamEngine } from './engine';

export interface StateSubscription {
  subscribe(channel: string, handler: (payload: string) => void): void;
}

interface PublishedState {
  lane?: Lane;
  state?: JsonObject & { entityId?: string };
}

export function bindStateBus(bus: StateSubscription, engine: StreamEngine, subscriber: string, now: () => number = Date.now): void {
  const previous = new Map<string, JsonObject>();
  bus.subscribe('state', (payload) => {
    const published = JSON.parse(payload) as PublishedState;
    const next = published.state ?? {};
    const id = typeof next.entityId === 'string' ? next.entityId : 'unknown';
    const prev = previous.get(id) ?? {};
    engine.push(subscriber, id, prev, next, published.lane ?? 'NORMAL', now());
    previous.set(id, next);
  });
}

export function prometheusText(metrics: { queueDepth: number; coalesced: number; dropped: number; batches: number; compressed: number }): string {
  return [
    '# TYPE livescope_stream_queue_depth gauge',
    `livescope_stream_queue_depth ${metrics.queueDepth}`,
    '# TYPE livescope_stream_coalesced_total counter',
    `livescope_stream_coalesced_total ${metrics.coalesced}`,
    '# TYPE livescope_stream_dropped_total counter',
    `livescope_stream_dropped_total ${metrics.dropped}`,
    '# TYPE livescope_stream_batches_total counter',
    `livescope_stream_batches_total ${metrics.batches}`,
    '# TYPE livescope_stream_compressed_total counter',
    `livescope_stream_compressed_total ${metrics.compressed}`,
  ].join('\n');
}
