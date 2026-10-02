import { describe, expect, it } from 'vitest';
import { alertFromSignal } from './alerts';
import { AnomalyDetector } from './ewma';
import { SERVICE } from './index';

describe('anomaly-detector', () => {
  it('exports its service name', () => {
    expect(SERVICE).toBe('anomaly-detector');
  });

  it('raises once and resolves after the value returns', () => {
    const detector = new AnomalyDetector({ warmup: 5, resolveAfter: 3, alpha: 0.3 });
    for (let i = 0; i < 8; i += 1) detector.update('api:latency', 10);
    expect(alertFromSignal(detector.update('api:latency', 10_000), 'api', 'latency', 10_000, 1)?.type).toBe('ALERT_RAISED');
    expect(detector.update('api:latency', 10)).toBe('ok');
    expect(detector.update('api:latency', 10)).toBe('ok');
    expect(detector.update('api:latency', 10)).toBe('resolve');
  });
});
