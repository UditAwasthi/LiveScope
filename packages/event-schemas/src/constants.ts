export const KafkaTopic = {
  METRICS_RAW: 'metrics.raw',
  LOGS_RAW: 'logs.raw',
  TRACES_RAW: 'traces.raw',
  EVENTS_DLQ: 'events.dlq',
} as const;

export const EventType = {
  METRIC_RECORDED: 'METRIC_RECORDED',
  LOG_EMITTED: 'LOG_EMITTED',
  SPAN_ENDED: 'SPAN_ENDED',
} as const;

export const EntityType = {
  SERVICE: 'service',
  TRACE: 'trace',
  ALERT: 'alert',
} as const;