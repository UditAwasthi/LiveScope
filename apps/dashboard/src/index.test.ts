import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyLiveMessage, pullState } from './live';
import { reconnectDelay, useDashboard } from './store';

describe('dashboard', () => {
  it('applies a snapshot then a patch without polling', async () => {
    useDashboard.getState().snapshot([{ id: 'api', status: 'up', latency: 10, errorRate: 0, rps: 5 }]);
    useDashboard.getState().applyPatch('api', { latency: 40 });
    useDashboard.getState().pushAlert('a1', 'error rate high');
    expect(useDashboard.getState().cards.api?.latency).toBe(40);
    expect(useDashboard.getState().alerts).toHaveLength(1);
    expect(reconnectDelay(3)).toBe(8000);
    const source = readFileSync('src/store.ts', 'utf8') + readFileSync('src/App.tsx', 'utf8');
    expect(source.includes('setInterval')).toBe(false);
    expect(source.includes('fetch(')).toBe(false);
    useDashboard.getState().setDivergence('api', 2);
    useDashboard.getState().setSeek('api', 12);
    expect(useDashboard.getState().divergence.api).toBe(2);
    expect(useDashboard.getState().seek.api).toBe(12);
    applyLiveMessage({ type: 'PATCH', id: 'api', changes: { rps: 9 } });
    expect(useDashboard.getState().cards.api?.rps).toBe(9);
    const past = await pullState(async () => ({ id: 'api', status: 'up', latency: 4, errorRate: 0, rps: 1 }), 'api', 12);
    expect(past?.latency).toBe(4);
  });
});
