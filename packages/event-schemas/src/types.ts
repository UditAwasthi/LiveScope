export type VectorClock = Record<string, number>;

export interface MetricPayload {
  metricName: string;
  value: number;
  tags: Record<string, string>;
}

export interface LogPayload {
  level: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface SpanPayload {
  operationName: string;
  durationMs: number;
  tags?: Record<string, string>;
}

export interface LiveScopeMetricEvent {
  id: string;
  type: 'METRIC_RECORDED';
  entity: string;
  entityId: string;
  timestamp: number;
  vectorClock: VectorClock;
  payload: MetricPayload;
}

export type LiveScopeEvent = LiveScopeMetricEvent;

export type DiffEventType = 'PATCH' | 'SNAPSHOT' | 'DELETE' | 'ALERT';

export interface DiffEvent {
  type: DiffEventType;
  entity: string;
  id: string;
  changes: Partial<Record<string, unknown>>;
}