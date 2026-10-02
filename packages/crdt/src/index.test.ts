import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { GCounter } from './g-counter';
import { LWWRegister } from './lww-register';
import { PNCounter } from './pn-counter';

const nodeId = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
const amount = fc.integer({ min: 0, max: 20 });

interface Op {
  nodeId: string;
  amount: number;
  kind: 'inc' | 'dec';
}

function sortedJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    const record = input as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = normalize(record[key]);
    }
    return sorted;
  };
  return JSON.stringify(normalize(value));
}

function applyPn(ops: Op[]): PNCounter {
  return ops.reduce((counter, op) => {
    return op.kind === 'inc'
      ? counter.increment(op.nodeId, op.amount)
      : counter.decrement(op.nodeId, op.amount);
  }, PNCounter.empty());
}

function mergeAll(counters: PNCounter[]): PNCounter {
  return counters.reduce((merged, counter) => merged.merge(counter), PNCounter.empty());
}

describe('GCounter', () => {
  it('sums a single node and ignores a zero increment', () => {
    const counter = GCounter.empty().increment('a', 2).increment('a', 3);
    expect(counter.value()).toBe(5);
    expect(counter.increment('a', 0).value()).toBe(5);
  });

  it('rejects a negative increment', () => {
    expect(() => GCounter.empty().increment('a', -1)).toThrow(/non-negative/);
  });

  it('keeps every node increment when each node writes only its own slot', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ nodeId, amount }), { maxLength: 30 }),
        (ops) => {
          const sequential = ops.reduce(
            (counter, op) => counter.increment(op.nodeId, op.amount),
            GCounter.empty(),
          );
          const byNode = new Map<string, GCounter>();
          for (const op of ops) {
            const current = byNode.get(op.nodeId) ?? GCounter.empty();
            byNode.set(op.nodeId, current.increment(op.nodeId, op.amount));
          }
          const merged = [...byNode.values()].reduce(
            (acc, counter) => acc.merge(counter),
            GCounter.empty(),
          );
          expect(merged.value()).toBe(sequential.value());
          expect(merged.value()).toBeGreaterThanOrEqual(sequential.value());
        },
      ),
    );
  });

  it('merge is commutative, associative, and idempotent', () => {
    const counterArb = fc
      .array(fc.record({ nodeId, amount }), { maxLength: 12 })
      .map((ops) =>
        ops.reduce((counter, op) => counter.increment(op.nodeId, op.amount), GCounter.empty()),
      );

    fc.assert(
      fc.property(counterArb, counterArb, counterArb, (a, b, c) => {
        expect(sortedJson(a.merge(b).toJSON())).toBe(sortedJson(b.merge(a).toJSON()));
        expect(sortedJson(a.merge(b).merge(c).toJSON())).toBe(sortedJson(a.merge(b.merge(c)).toJSON()));
        expect(sortedJson(a.merge(a).toJSON())).toBe(sortedJson(a.toJSON()));
        expect(a.merge(b).value()).toBeGreaterThanOrEqual(a.value());
        expect(a.merge(b).value()).toBeGreaterThanOrEqual(b.value());
      }),
    );
  });
});

describe('PNCounter', () => {
  it('subtracts decrements from increments', () => {
    const counter = PNCounter.empty().increment('a', 5).decrement('b', 2);
    expect(counter.value()).toBe(3);
  });

  it('converges when the same per-node history is merged in either order', () => {
    const opArb = fc.record({
      nodeId,
      amount,
      kind: fc.constantFrom('inc' as const, 'dec' as const),
    });

    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 24 }), (ops) => {
        const sequential = applyPn(ops);
        const byNode = new Map<string, Op[]>();
        for (const op of ops) {
          const group = byNode.get(op.nodeId) ?? [];
          group.push(op);
          byNode.set(op.nodeId, group);
        }
        const parts = [...byNode.values()].map((group) => applyPn(group));
        const forward = mergeAll(parts);
        const backward = mergeAll([...parts].reverse());
        expect(forward.value()).toBe(sequential.value());
        expect(sortedJson(forward.toJSON())).toBe(sortedJson(backward.toJSON()));
        expect(sortedJson(forward.merge(forward).toJSON())).toBe(sortedJson(forward.toJSON()));
      }),
    );
  });
});

describe('LWWRegister', () => {
  it('lets the later timestamp win and breaks ties by nodeId', () => {
    const first = LWWRegister.of('old', 1, 'a');
    const later = first.set('new', 2, 'b');
    expect(later.get()?.value).toBe('new');

    const tie = LWWRegister.of('left', 5, 'a').merge(LWWRegister.of('right', 5, 'b'));
    expect(tie.get()?.value).toBe('right');
  });

  it('empty merge is identity', () => {
    const register = LWWRegister.of(1, 1, 'a');
    expect(register.merge(LWWRegister.empty<number>()).get()).toEqual(register.get());
    expect(LWWRegister.empty<number>().merge(register).get()).toEqual(register.get());
  });

  it('merge converges to the same winner regardless of order', () => {
    const writeArb = fc.record({
      value: fc.string({ maxLength: 8 }),
      timestamp: fc.integer({ min: 0, max: 100 }),
      nodeId,
    });

    fc.assert(
      fc.property(fc.array(writeArb, { minLength: 1, maxLength: 20 }), (writes) => {
        const registers = writes.map((write) => LWWRegister.of(write.value, write.timestamp, write.nodeId));
        const forward = registers.reduce((acc, register) => acc.merge(register), LWWRegister.empty<string>());
        const backward = [...registers]
          .reverse()
          .reduce((acc, register) => acc.merge(register), LWWRegister.empty<string>());
        expect(forward.get()).toEqual(backward.get());
        expect(forward.merge(forward).get()).toEqual(forward.get());
      }),
    );
  });
});
