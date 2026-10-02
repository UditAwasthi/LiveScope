import type { AnomalySignal } from './ewma';

export interface AlertRecord {
  type: 'ALERT_RAISED' | 'ALERT_RESOLVED';
  entityId: string;
  timestamp: number;
  payload: { metricName: string; value: number; severity: 'high' | 'info' };
}

export function alertFromSignal(
  signal: AnomalySignal,
  entityId: string,
  metricName: string,
  value: number,
  now: number,
): AlertRecord | undefined {
  if (signal !== 'raise' && signal !== 'resolve') return undefined;
  return {
    type: signal === 'raise' ? 'ALERT_RAISED' : 'ALERT_RESOLVED',
    entityId,
    timestamp: now,
    payload: { metricName, value, severity: signal === 'raise' ? 'high' : 'info' },
  };
}
