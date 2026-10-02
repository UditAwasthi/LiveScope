import { describe, expect, it } from 'vitest';
import { executePlan, KillSwitch } from './actions';
import { canPromote, injectionStaysData, predictiveDemo, runScenarios } from './benchmark';
import { transition } from './incidents';
import { SystemTwin } from './twin';

describe('reliability loop', () => {
  it('runs the six scenarios with cited hypotheses and at least two fixes', () => {
    const results = runScenarios();
    expect(results).toHaveLength(6);
    for (const result of results) {
      expect(result.topHypothesis).toBe(result.cause);
      expect(result.compared).toBeGreaterThanOrEqual(2);
      expect(result.verified).toBe(true);
    }
  });

  it('keeps injected instructions out of the tool list', () => {
    expect(injectionStaysData()).toBe(true);
  });

  it('rolls back when verification fails and stops on the kill switch', () => {
    const cluster = { versions: { api: 'v2' }, previous: { api: 'v1' }, replicas: { api: 1 }, restarted: [], fallbacks: [], configs: {} };
    const failed = executePlan({
      steps: [{ action: 'rollback_deployment', service: 'api', rollback: 'forward' }],
      cluster,
      approved: true,
      auto: false,
      kill: new KillSwitch(),
      now: 1,
      verify: () => false,
    });
    expect(failed.status).toBe('rolled_back');
    expect(cluster.versions.api).toBe('v2');

    const kill = new KillSwitch();
    kill.emergency(5);
    const halted = executePlan({
      steps: [{ action: 'restart_service', service: 'api', rollback: 'none' }],
      cluster,
      approved: false,
      auto: true,
      kill,
      now: 6,
      verify: () => true,
    });
    expect(halted.status).toBe('halted');
    expect(kill.stoppedAt).toBe(5);
  });

  it('refuses an illegal incident transition and a premature autonomy promotion', () => {
    expect(() => transition('DETECTED', 'RESOLVED')).toThrow(/illegal/);
    expect(canPromote({ verified: 1, violations: 0 }, 'APPROVAL_REQUIRED', 'AUTO_SAFE')).toBe(false);
    expect(canPromote({ verified: 3, violations: 0 }, 'APPROVAL_REQUIRED', 'AUTO_SAFE')).toBe(true);
  });

  it('answers twin queries and forecasts saturation', () => {
    const twin = new SystemTwin();
    twin.observe({ service: 'api', version: 'v1', health: 'up', at: 10, provenance: 'declared', source: 'catalog' });
    twin.connect({ from: 'api', to: 'db', provenance: 'inferred', at: 10 });
    expect(twin.at('api', 5)).toBeUndefined();
    expect(twin.at('api', 10)?.version).toBe('v1');
    expect(twin.dependencies('api')).toHaveLength(1);
    expect(twin.current('api', 10).fact?.provenance).toBe('declared');
    const forecast = predictiveDemo();
    expect(forecast.etaMs).not.toBeNull();
  });
});
