import { describe, expect, it } from 'vitest';
import { concurrentCount, deliver } from './partition';
import { SERVICE } from './index';

describe('region-simulator', () => {
  it('exports its service name', () => {
    expect(SERVICE).toBe('region-simulator');
  });

  it('drops cross-region events during a partition and counts divergence', () => {
    expect(deliver({ region: 'eu', entityId: 'api', clock: { eu: 1 } }, 'us', true).deliver).toBe(false);
    expect(deliver({ region: 'us', entityId: 'api', clock: { us: 1 } }, 'us', true).deliver).toBe(true);
    expect(concurrentCount([{ us: 2 }, { eu: 2 }])).toBe(1);
    expect(concurrentCount([{ us: 1 }, { us: 2 }])).toBe(0);
  });
});
