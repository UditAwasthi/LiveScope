import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyPatch, diff, Deleted, isDeleted, type JsonObject } from './index';

const key = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
const primitive = fc.oneof(
  fc.string({ maxLength: 8 }),
  fc.integer({ min: -50, max: 50 }),
  fc.boolean(),
  fc.constant(null),
);
const nested = fc.dictionary(key, primitive, { maxKeys: 4 });
const objectArb: fc.Arbitrary<JsonObject> = fc.dictionary(key, fc.oneof(primitive, nested), {
  maxKeys: 5,
});

describe('diff engine', () => {
  it('returns an empty patch for identical objects', () => {
    fc.assert(
      fc.property(objectArb, (value) => {
        expect(diff(value, value)).toEqual({});
      }),
    );
  });

  it('round-trips applyPatch(prev, diff(prev, next)) back to next', () => {
    fc.assert(
      fc.property(objectArb, objectArb, (prev, next) => {
        const before = structuredClone(prev);
        const patched = applyPatch(prev, diff(prev, next));
        expect(patched).toEqual(next);
        expect(prev).toEqual(before);
      }),
    );
  });

  it('diffs one level into nested objects and deletes removed keys', () => {
    const prev = { status: 'up', metrics: { rps: 10, errors: 1 } };
    const next = { status: 'down', metrics: { rps: 12 } };
    const patch = diff(prev, next);

    expect(patch.status).toBe('down');
    expect(patch.metrics).toEqual({ rps: 12, errors: Deleted });
    expect(isDeleted((patch.metrics as JsonObject).errors)).toBe(true);
    expect(applyPatch(prev, patch)).toEqual(next);
  });
});
