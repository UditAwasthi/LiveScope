import { describe, expect, it } from 'vitest';
import { ChaosEngine } from './faults';
import { SERVICE } from './index';

describe('chaos-engine', () => {
  it('exports its service name', () => {
    expect(SERVICE).toBe('chaos-engine');
  });

  it('expires faults and logs them', () => {
    const chaos = new ChaosEngine();
    chaos.inject('redisDown', 1, 100, 0);
    expect(chaos.redisWritable(50)).toBe(false);
    expect(chaos.redisWritable(150)).toBe(true);
    expect(chaos.log).toHaveLength(1);
    chaos.inject('dropPercent', 100, 1000, 0);
    expect(chaos.shouldDrop(10, 0.2)).toBe(true);
  });
});
