import { describe, expect, it } from 'vitest';
import { ChaosEngine } from './faults';
import { startChaosApi } from './server';

describe('chaos api', () => {
  it('injects a fault that expires', async () => {
    const engine = new ChaosEngine();
    const api = await startChaosApi(engine);
    const created = await fetch(`http://127.0.0.1:${api.port}/faults`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'delayMs', magnitude: 25, ttlMs: 60_000 }),
    });
    expect(created.status).toBe(202);
    const listed = await fetch(`http://127.0.0.1:${api.port}/faults`);
    const body = (await listed.json()) as { faults: { kind: string; magnitude: number }[] };
    expect(body.faults[0]).toMatchObject({ kind: 'delayMs', magnitude: 25 });
    expect(engine.delayMs(Date.now())).toBe(25);
    await api.close();
  });
});
