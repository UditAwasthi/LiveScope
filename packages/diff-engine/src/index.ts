export const Deleted: unique symbol = Symbol.for('livescope.diff.deleted');

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonPrimitive | JsonObject };
export type PatchValue = JsonPrimitive | JsonObject | Patch | typeof Deleted;
export interface Patch {
  [key: string]: PatchValue;
}

const UNSAFE_KEY = new Set(['__proto__', 'prototype', 'constructor']);

export function isDeleted(value: unknown): value is typeof Deleted {
  return value === Deleted;
}

function assertKey(key: string): void {
  if (UNSAFE_KEY.has(key)) {
    throw new Error(`unsafe object key: ${key}`);
  }
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!deepEqual(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}

function copyObject(source: JsonObject | Patch): JsonObject {
  const copy: JsonObject = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isDeleted(value)) continue;
    if (typeof value === 'object' && value !== null) {
      copy[key] = copyObject(value);
      continue;
    }
    copy[key] = value;
  }
  return copy;
}

/**
 * Shallow diff, plus one nested object level.
 * A removed key is `Deleted`. Identical objects produce `{}`.
 */
export function diff(prev: JsonObject, next: JsonObject, depth = 0): Patch {
  const patch: Patch = {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of keys) {
    assertKey(key);
    const hasPrev = Object.prototype.hasOwnProperty.call(prev, key);
    const hasNext = Object.prototype.hasOwnProperty.call(next, key);

    if (!hasNext) {
      patch[key] = Deleted;
      continue;
    }

    const after = next[key];
    if (!hasPrev) {
      patch[key] = isPlainObject(after) ? copyObject(after) : after;
      continue;
    }

    const before = prev[key];
    if (deepEqual(before, after)) continue;

    if (depth === 0 && isPlainObject(before) && isPlainObject(after)) {
      const nested = diff(before, after, depth + 1);
      if (Object.keys(nested).length > 0) patch[key] = nested;
      continue;
    }

    patch[key] = isPlainObject(after) ? copyObject(after) : after;
  }

  return patch;
}

/** Immutable apply. Nested plain objects merge one level; everything else replaces. */
export function applyPatch(state: JsonObject, patch: Patch, depth = 0): JsonObject {
  const next = copyObject(state);

  for (const key of Object.keys(patch)) {
    assertKey(key);
    const change = patch[key];
    if (isDeleted(change)) {
      delete next[key];
      continue;
    }

    const current = next[key];
    if (
      depth === 0 &&
      isPlainObject(current) &&
      typeof change === 'object' &&
      change !== null
    ) {
      next[key] = applyPatch(current, change, depth + 1);
      continue;
    }

    if (typeof change === 'object' && change !== null) {
      next[key] = copyObject(change);
      continue;
    }

    next[key] = change;
  }

  return next;
}
