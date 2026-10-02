import { describe, expect, it } from 'vitest';
import { evaluate, parseFilter, VERSION } from './index';

describe('@livescope/query-engine', () => {
  it('exports a version', () => {
    expect(VERSION).toBe('1.0.0');
  });

  it('treats comma-separated clauses as OR', () => {
    const filter = parseFilter('latency > 200, errors != 0');
    expect(evaluate(filter, { latency: 10, errors: 2 })).toBe(true);
    expect(evaluate(filter, { latency: 10, errors: 0 })).toBe(false);
    expect(evaluate(filter, { latency: 250, errors: 0 })).toBe(true);
  });
});
