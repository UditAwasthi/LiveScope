import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compare, merge, tick, type VectorClock } from './index';

const nodeId = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
const clockArb = fc.dictionary(nodeId, fc.integer({ min: 0, max: 20 }), { maxKeys: 6 });

describe('vector clock', () => {
  it('covers the four orderings', () => {
    expect(compare({ a: 1 }, { a: 1 })).toBe('EQUAL');
    expect(compare({ a: 1 }, { a: 2 })).toBe('BEFORE');
    expect(compare({ a: 2 }, { a: 1 })).toBe('AFTER');
    expect(compare({ a: 1 }, { b: 1 })).toBe('CONCURRENT');
    expect(compare({ a: 1, b: 2 }, { a: 2, b: 1 })).toBe('CONCURRENT');
    expect(compare({ a: 1 }, { a: 1, b: 1 })).toBe('BEFORE');
  });

  it('treats a missing counter as zero', () => {
    expect(compare({ a: 0 }, {})).toBe('EQUAL');
  });

  it('tick moves the clock strictly after itself', () => {
    fc.assert(
      fc.property(clockArb, nodeId, (clock, id) => {
        expect(compare(tick(clock, id), clock)).toBe('AFTER');
      }),
    );
  });

  it('merge is commutative, associative, and idempotent', () => {
    fc.assert(
      fc.property(clockArb, clockArb, clockArb, (a, b, c) => {
        expect(compare(merge(a, b), merge(b, a))).toBe('EQUAL');
        expect(compare(merge(merge(a, b), c), merge(a, merge(b, c)))).toBe('EQUAL');
        expect(compare(merge(a, a), a)).toBe('EQUAL');
      }),
    );
  });

  it('merge dominates both inputs', () => {
    fc.assert(
      fc.property(clockArb, clockArb, (a, b) => {
        const merged = merge(a, b);
        const leftOrder = compare(a, merged);
        const rightOrder = compare(b, merged);
        expect(leftOrder === 'BEFORE' || leftOrder === 'EQUAL').toBe(true);
        expect(rightOrder === 'BEFORE' || rightOrder === 'EQUAL').toBe(true);
      }),
    );
  });

  it('rejects a negative counter', () => {
    const bad = { a: -1 } as VectorClock;
    expect(() => compare(bad, {})).toThrow(/non-negative/);
  });
});
