import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from './circuit-breaker';
import { healthCheck } from './health';
import { signJwt, verifyJwt } from './jwt';
import { createLogger } from './index';
import { withRetry } from './retry';

describe('createLogger', () => {
  it('writes JSON lines at or above the configured level', () => {
    const lines: string[] = [];
    const logger = createLogger('gateway', { level: 'info', sink: (line) => lines.push(line) });
    logger.debug('hidden');
    logger.info('visible', { entityId: 'api' });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ level: 'info', name: 'gateway', msg: 'visible' });
  });
});

describe('withRetry', () => {
  it('retries then returns', async () => {
    let calls = 0;
    const value = await withRetry(async () => {
      calls += 1;
      if (calls < 2) throw new Error('not yet');
      return 'ok';
    }, { retries: 2, backoffMs: 1 });
    expect(value).toBe('ok');
  });
});

describe('CircuitBreaker', () => {
  it('opens after the failure threshold and rejects fast', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetMs: 10_000 });
    await expect(breaker.exec(async () => { throw new Error('down'); })).rejects.toThrow('down');
    await expect(breaker.exec(async () => { throw new Error('down'); })).rejects.toThrow('down');
    await expect(breaker.exec(async () => 'up')).rejects.toThrow(/circuit open/);
  });
});

describe('healthCheck', () => {
  it('reports a failed dependency', async () => {
    const report = await healthCheck({ kafka: async () => false, self: async () => true });
    expect(report.ok).toBe(false);
  });
});

describe('jwt', () => {
  it('round-trips a signed token and rejects a bad signature', () => {
    const token = signJwt({ sub: 'ada' }, 'secret', 60);
    expect(verifyJwt(token, 'secret')?.sub).toBe('ada');
    expect(verifyJwt(token, 'other')).toBeUndefined();
  });
});
