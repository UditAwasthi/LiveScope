import { describe, expect, it } from 'vitest';
import { signJwt } from '@livescope/utils';
import { accept, authorize } from './protocol';
import { SERVICE } from './index';

describe('websocket-gateway', () => {
  it('exports its service name', () => {
    expect(SERVICE).toBe('websocket-gateway');
  });

  it('rejects a missing token and filters diffs', () => {
    expect(authorize(undefined, 'secret')).toBe(false);
    const token = signJwt({ sub: 'ada' }, 'secret', 60);
    expect(authorize(token, 'secret')).toBe(true);
    const event = { type: 'PATCH' as const, entity: 'service', id: 'api', changes: { latency: 10 } };
    expect(accept(event, { entity: 'api', filter: 'latency > 200' })).toBe(false);
    expect(accept(event, { entity: 'api', filter: 'latency < 200' })).toBe(true);
  });
});
