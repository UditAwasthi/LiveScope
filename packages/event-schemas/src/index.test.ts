import { describe, expect, it } from 'vitest';
import { EventType, KafkaTopic, topicFor } from './constants';
import { InMemorySchemaRegistry, listSchemaFiles, readSchema, registerAllSchemas } from './serializer';
import { validateEvent } from './validate';

describe('@livescope/event-schemas', () => {
  it('names the raw topics', () => {
    expect(KafkaTopic.METRICS_RAW).toBe('metrics.raw');
    expect(topicFor(EventType.LOG_EMITTED)).toBe('logs.raw');
    expect(topicFor(EventType.ALERT_RAISED)).toBe('alerts.raw');
  });

  it('registers each schema file once for identical content', async () => {
    const registry = new InMemorySchemaRegistry();
    const first = await registerAllSchemas(registry);
    const second = await registerAllSchemas(registry);
    expect(listSchemaFiles().length).toBeGreaterThanOrEqual(4);
    expect(second).toEqual(first);
    const text = readSchema(listSchemaFiles()[0]!);
    expect(registry.register(text)).toBe(registry.register(text));
  });

  it('rejects a malformed metric and accepts a log', () => {
    expect(validateEvent({ type: 'METRIC_RECORDED' }).ok).toBe(false);
    const log = validateEvent({
      id: 'l1',
      type: 'LOG_EMITTED',
      entity: 'service',
      entityId: 'api',
      timestamp: 1,
      vectorClock: { a: 1 },
      payload: { level: 'info', message: 'hello', context: {} },
    });
    expect(log.ok).toBe(true);
  });
});
