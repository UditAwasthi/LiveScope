export const KafkaTopic = {
  METRICS_RAW: 'metrics.raw',
  LOGS_RAW: 'logs.raw',
  TRACES_RAW: 'traces.raw',
  ALERTS_RAW: 'alerts.raw',
  EVENTS_DLQ: 'events.dlq',
} as const;

export const EventType = {
  METRIC_RECORDED: 'METRIC_RECORDED',
  LOG_EMITTED: 'LOG_EMITTED',
  SPAN_ENDED: 'SPAN_ENDED',
  ALERT_RAISED: 'ALERT_RAISED',
  ALERT_RESOLVED: 'ALERT_RESOLVED',
} as const;

export const EntityType = {
  SERVICE: 'service',
  TRACE: 'trace',
  ALERT: 'alert',
} as const;

export const DEFAULT_SCOPE = {
  orgId: 'local',
  projectId: 'default',
  environment: 'dev',
  region: 'local',
} as const;

const TOPIC_BY_TYPE = {
  METRIC_RECORDED: KafkaTopic.METRICS_RAW,
  LOG_EMITTED: KafkaTopic.LOGS_RAW,
  SPAN_ENDED: KafkaTopic.TRACES_RAW,
  ALERT_RAISED: KafkaTopic.ALERTS_RAW,
  ALERT_RESOLVED: KafkaTopic.ALERTS_RAW,
} as const;

export function topicFor(type: keyof typeof TOPIC_BY_TYPE): string {
  return TOPIC_BY_TYPE[type];
}
