import { deflateSync } from 'node:zlib';
import { applyPatch, diff, type JsonObject, type Patch } from '@livescope/diff-engine';
import type { DiffEvent } from '@livescope/event-schemas';

export type Lane = 'HIGH' | 'NORMAL';

export interface StreamMetrics {
  queueDepth: number;
  coalesced: number;
  dropped: number;
  batches: number;
  compressed: number;
}

interface Pending {
  entityId: string;
  patch: Patch;
  at: number;
}

export class StreamEngine {
  private readonly queues = new Map<string, DiffEvent[]>();
  private readonly pending = new Map<string, Pending>();
  readonly metrics: StreamMetrics = { queueDepth: 0, coalesced: 0, dropped: 0, batches: 0, compressed: 0 };

  constructor(private readonly options: { maxQueue?: number; coalesceMs?: number } = {}) {}

  push(subscriber: string, entityId: string, prev: JsonObject, next: JsonObject, lane: Lane, now: number): DiffEvent | undefined {
    const patch = diff(prev, next);
    if (Object.keys(patch).length === 0 && lane === 'NORMAL') return undefined;
    const event: DiffEvent = { type: lane === 'HIGH' ? 'ALERT' : 'PATCH', entity: 'service', id: entityId, changes: patch };
    if (lane === 'HIGH') {
      this.enqueue(subscriber, event);
      return event;
    }
    const waiting = this.pending.get(`${subscriber}:${entityId}`);
    if (waiting && now - waiting.at <= (this.options.coalesceMs ?? 50)) {
      const merged = applyPatch({}, waiting.patch) as JsonObject;
      const combined = diff({}, applyPatch(merged, patch));
      this.pending.set(`${subscriber}:${entityId}`, { entityId, patch: combined, at: waiting.at });
      this.metrics.coalesced += 1;
      return undefined;
    }
    this.pending.set(`${subscriber}:${entityId}`, { entityId, patch, at: now });
    return event;
  }

  flush(subscriber: string, now: number): DiffEvent[] {
    const ready: DiffEvent[] = [];
    for (const [key, item] of this.pending) {
      if (!key.startsWith(`${subscriber}:`)) continue;
      if (now - item.at < (this.options.coalesceMs ?? 50)) continue;
      const event: DiffEvent = { type: 'PATCH', entity: 'service', id: item.entityId, changes: item.patch };
      this.enqueue(subscriber, event);
      ready.push(event);
      this.pending.delete(key);
    }
    this.metrics.batches += ready.length > 0 ? 1 : 0;
    return ready;
  }

  encodeBatch(events: DiffEvent[]): { codec: 'none' | 'deflate'; bytes: number } {
    const raw = Buffer.from(JSON.stringify(events));
    if (raw.length <= 1024) return { codec: 'none', bytes: raw.length };
    this.metrics.compressed += 1;
    return { codec: 'deflate', bytes: deflateSync(raw).length };
  }

  private enqueue(subscriber: string, event: DiffEvent): void {
    const queue = this.queues.get(subscriber) ?? [];
    const max = this.options.maxQueue ?? 100;
    if (event.type !== 'ALERT' && queue.length >= max) {
      const stale = queue.findIndex((item) => item.type === 'PATCH' && item.id === event.id);
      if (stale >= 0) queue.splice(stale, 1);
      else if (queue.length >= max) {
        const normal = queue.findIndex((item) => item.type === 'PATCH');
        if (normal >= 0) queue.splice(normal, 1);
      }
      this.metrics.dropped += 1;
    }
    queue.push(event);
    this.queues.set(subscriber, queue);
    this.metrics.queueDepth = queue.length;
  }

  queue(subscriber: string): DiffEvent[] {
    return this.queues.get(subscriber) ?? [];
  }
}
