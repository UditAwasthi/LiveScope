import { DEFAULT_SCOPE } from './constants';
import type { LiveScopeEvent, VectorClock } from './types';

export type Validation = { ok: true; event: LiveScopeEvent } | { ok: false; reason: string };

const TYPES = new Set([
  'METRIC_RECORDED',
  'LOG_EMITTED',
  'SPAN_ENDED',
  'ALERT_RAISED',
  'ALERT_RESOLVED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') return undefined;
    out[key] = item;
  }
  return out;
}

function clock(value: unknown): VectorClock | undefined {
  if (!isRecord(value)) return undefined;
  const out: VectorClock = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) return undefined;
    out[key] = item;
  }
  return out;
}

export function validateEvent(input: unknown): Validation {
  if (!isRecord(input)) return { ok: false, reason: 'event must be an object' };
  if (typeof input.id !== 'string' || input.id.length === 0) return { ok: false, reason: 'id required' };
  if (typeof input.type !== 'string' || !TYPES.has(input.type)) return { ok: false, reason: 'unknown type' };
  if (typeof input.entity !== 'string' || typeof input.entityId !== 'string' || input.entityId.length === 0) {
    return { ok: false, reason: 'entity and entityId required' };
  }
  if (typeof input.timestamp !== 'number' || !Number.isFinite(input.timestamp)) {
    return { ok: false, reason: 'timestamp required' };
  }
  const vectorClock = clock(input.vectorClock ?? {});
  if (!vectorClock) return { ok: false, reason: 'vectorClock invalid' };
  if (!isRecord(input.payload)) return { ok: false, reason: 'payload required' };

  const base = {
    id: input.id,
    entity: input.entity,
    entityId: input.entityId,
    timestamp: input.timestamp,
    vectorClock,
    orgId: typeof input.orgId === 'string' ? input.orgId : DEFAULT_SCOPE.orgId,
    projectId: typeof input.projectId === 'string' ? input.projectId : DEFAULT_SCOPE.projectId,
    environment: typeof input.environment === 'string' ? input.environment : DEFAULT_SCOPE.environment,
    region: typeof input.region === 'string' ? input.region : DEFAULT_SCOPE.region,
  };

  if (input.type === 'METRIC_RECORDED') {
    const tags = stringMap(input.payload.tags ?? {});
    if (typeof input.payload.metricName !== 'string' || typeof input.payload.value !== 'number' || !tags) {
      return { ok: false, reason: 'metric payload invalid' };
    }
    return {
      ok: true,
      event: { ...base, type: 'METRIC_RECORDED', payload: { metricName: input.payload.metricName, value: input.payload.value, tags } },
    };
  }

  if (input.type === 'LOG_EMITTED') {
    const context = stringMap(input.payload.context ?? {});
    if (typeof input.payload.level !== 'string' || typeof input.payload.message !== 'string' || !context) {
      return { ok: false, reason: 'log payload invalid' };
    }
    return { ok: true, event: { ...base, type: 'LOG_EMITTED', payload: { level: input.payload.level, message: input.payload.message, context } } };
  }

  if (input.type === 'SPAN_ENDED') {
    const tags = stringMap(input.payload.tags ?? {});
    if (
      typeof input.payload.operationName !== 'string' ||
      typeof input.payload.durationMs !== 'number' ||
      typeof input.payload.traceId !== 'string' ||
      typeof input.payload.spanId !== 'string' ||
      !tags
    ) {
      return { ok: false, reason: 'span payload invalid' };
    }
    const parent = typeof input.payload.parentSpanId === 'string' ? input.payload.parentSpanId : '';
    return {
      ok: true,
      event: {
        ...base,
        type: 'SPAN_ENDED',
        payload: {
          operationName: input.payload.operationName,
          durationMs: input.payload.durationMs,
          traceId: input.payload.traceId,
          spanId: input.payload.spanId,
          parentSpanId: parent,
          tags,
        },
      },
    };
  }

  const severity = input.payload.severity;
  if (
    typeof input.payload.alertId !== 'string' ||
    typeof input.payload.metricName !== 'string' ||
    (severity !== 'info' && severity !== 'warning' && severity !== 'critical') ||
    typeof input.payload.value !== 'number' ||
    typeof input.payload.threshold !== 'number'
  ) {
    return { ok: false, reason: 'alert payload invalid' };
  }
  return {
    ok: true,
    event: {
      ...base,
      type: input.type === 'ALERT_RESOLVED' ? 'ALERT_RESOLVED' : 'ALERT_RAISED',
      payload: {
        alertId: input.payload.alertId,
        metricName: input.payload.metricName,
        severity,
        value: input.payload.value,
        threshold: input.payload.threshold,
      },
    },
  };
}
