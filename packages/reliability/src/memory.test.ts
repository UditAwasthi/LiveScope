import { describe, expect, it } from 'vitest';
import { IncidentMemory, investigateWithMemory } from './memory';
import type { Evidence } from './investigate';

const evidence: Evidence[] = [
  { id: 'd1', kind: 'deploy', summary: 'checkout deployed v2', at: 1 },
  { id: 'm1', kind: 'metric', summary: 'error rate rose', at: 2 },
];

describe('incident memory', () => {
  it('surfaces a prior diagnosis for the same cause and service', () => {
    const memory = new IncidentMemory();
    memory.remember({
      cause: 'deployment_regression',
      service: 'checkout',
      diagnosis: 'rollback v2',
    });
    const fresh = investigateWithMemory(evidence, new IncidentMemory(), 'checkout');
    const repeat = investigateWithMemory(evidence, memory, 'checkout');
    expect(fresh.hypotheses[0]?.summary.includes('Prior diagnosis')).toBe(false);
    expect(repeat.hypotheses[0]?.summary).toContain('rollback v2');
    expect(repeat.hypotheses[0]?.id).toBe('deployment_regression');
  });
});
