import { topicFor, validateEvent, type LiveScopeEvent } from '@livescope/event-schemas';
import { CircuitBreaker, UnavailableError } from '@livescope/utils';

export interface ProducedRecord {
  topic: string;
  key: string;
  value: Buffer;
}

export interface EventProducer {
  send(record: ProducedRecord): Promise<void>;
}

export interface FaultGate {
  shouldDrop(now: number): boolean;
  delayMs(now: number): number;
}

export interface IngestDeps {
  producer: EventProducer;
  breaker: CircuitBreaker;
  encode: (event: LiveScopeEvent) => Promise<Buffer> | Buffer;
  faults?: FaultGate;
  sleep?: (ms: number) => Promise<void>;
}

export type IngestResult =
  | { status: 'ack'; eventId: string; topic: string }
  | { status: 'dlq'; reason: string }
  | { status: 'dropped' };

export async function ingest(input: unknown, deps: IngestDeps, now = Date.now()): Promise<IngestResult> {
  if (deps.faults?.shouldDrop(now)) return { status: 'dropped' };
  const delay = deps.faults?.delayMs(now) ?? 0;
  if (delay > 0) await (deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(delay);

  const validated = validateEvent(input);
  if (!validated.ok) {
    await deps.breaker.exec(() =>
      deps.producer.send({
        topic: 'events.dlq',
        key: 'malformed',
        value: Buffer.from(JSON.stringify({ reason: validated.reason, input })),
      }),
    );
    return { status: 'dlq', reason: validated.reason };
  }

  const event = validated.event;
  const topic = topicFor(event.type);
  const value = Buffer.from(await deps.encode(event));
  await deps.breaker.exec(() => deps.producer.send({ topic, key: event.entityId, value }));
  return { status: 'ack', eventId: event.id, topic };
}

export function otlpJsonToEvents(body: unknown): unknown[] {
  if (typeof body !== 'object' || body === null) return [];
  const resourceMetrics = (body as { resourceMetrics?: unknown }).resourceMetrics;
  if (!Array.isArray(resourceMetrics)) return [];
  const events: unknown[] = [];
  for (const resource of resourceMetrics) {
    if (typeof resource !== 'object' || resource === null) continue;
    const scopes = (resource as { scopeMetrics?: unknown[] }).scopeMetrics ?? [];
    for (const scope of scopes) {
      if (typeof scope !== 'object' || scope === null) continue;
      const metrics = (scope as { metrics?: unknown[] }).metrics ?? [];
      for (const metric of metrics) {
        if (typeof metric !== 'object' || metric === null) continue;
        const name = (metric as { name?: string }).name;
        const points = (metric as { gauge?: { dataPoints?: { asDouble?: number; asInt?: number }[] } }).gauge?.dataPoints ?? [];
        for (const point of points) {
          const value = point.asDouble ?? point.asInt;
          if (typeof name !== 'string' || typeof value !== 'number') continue;
          events.push({
            id: `otlp-${name}-${events.length}`,
            type: 'METRIC_RECORDED',
            entity: 'service',
            entityId: 'otel',
            timestamp: Date.now(),
            vectorClock: {},
            payload: { metricName: name, value, tags: { source: 'otlp' } },
          });
        }
      }
    }
  }
  return events;
}

export { UnavailableError };
