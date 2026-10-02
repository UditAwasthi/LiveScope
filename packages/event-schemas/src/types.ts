export type VectorClock = Record<string, number>;

export type EventTypeName =
  | 'METRIC_RECORDED'
  | 'LOG_EMITTED'
  | 'SPAN_ENDED'
  | 'ALERT_RAISED'
  | 'ALERT_RESOLVED';

export interface EventBase {
  id: string;
  entity: string;
  entityId: string;
  timestamp: number;
  vectorClock: VectorClock;
  orgId: string;
  projectId: string;
  environment: string;
  region: string;
}

export interface MetricPayload {
  metricName: string;
  value: number;
  tags: Record<string, string>;
}

export interface LogPayload {
  level: string;
  message: string;
  context: Record<string, string>;
}

export interface SpanPayload {
  operationName: string;
  durationMs: number;
  traceId: string;
  spanId: string;
  parentSpanId: string;
  tags: Record<string, string>;
}

export interface AlertPayload {
  alertId: string;
  metricName: string;
  severity: 'info' | 'warning' | 'critical';
  value: number;
  threshold: number;
}

export interface LiveScopeMetricEvent extends EventBase {
  type: 'METRIC_RECORDED';
  payload: MetricPayload;
}

export interface LiveScopeLogEvent extends EventBase {
  type: 'LOG_EMITTED';
  payload: LogPayload;
}

export interface LiveScopeSpanEvent extends EventBase {
  type: 'SPAN_ENDED';
  payload: SpanPayload;
}

export interface LiveScopeAlertEvent extends EventBase {
  type: 'ALERT_RAISED' | 'ALERT_RESOLVED';
  payload: AlertPayload;
}

export type LiveScopeEvent =
  | LiveScopeMetricEvent
  | LiveScopeLogEvent
  | LiveScopeSpanEvent
  | LiveScopeAlertEvent;

export type DiffEventType = 'PATCH' | 'SNAPSHOT' | 'DELETE' | 'ALERT';

export interface DiffEvent {
  type: DiffEventType;
  entity: string;
  id: string;
  changes: Partial<Record<string, unknown>>;
}

export interface Scope {
  orgId: string;
  projectId: string;
  environment: string;
}

export function scopeKey(scope: Scope, entityId: string): string {
  return `${scope.orgId}/${scope.projectId}/${scope.environment}/${entityId}`;
}

export function sameScope(left: Scope, right: Scope): boolean {
  return (
    left.orgId === right.orgId &&
    left.projectId === right.projectId &&
    left.environment === right.environment
  );
}
