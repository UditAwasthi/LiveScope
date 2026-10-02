export type VectorClock = Record<string, number>;

export type ClockOrder = 'EQUAL' | 'BEFORE' | 'AFTER' | 'CONCURRENT';

const NODE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

function assertNodeId(nodeId: string): void {
  if (!NODE_ID.test(nodeId)) {
    throw new Error(`invalid nodeId: ${nodeId}`);
  }
}

function counter(clock: VectorClock, nodeId: string): number {
  const value = clock[nodeId] ?? 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`vector clock counter for ${nodeId} must be a non-negative integer`);
  }
  return value;
}

export function tick(clock: VectorClock, nodeId: string): VectorClock {
  assertNodeId(nodeId);
  return { ...clock, [nodeId]: counter(clock, nodeId) + 1 };
}

export function merge(left: VectorClock, right: VectorClock): VectorClock {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const merged: VectorClock = {};
  for (const key of keys) {
    merged[key] = Math.max(counter(left, key), counter(right, key));
  }
  return merged;
}

/** `AFTER` means `left` causally dominates `right`. Missing counters are zero. */
export function compare(left: VectorClock, right: VectorClock): ClockOrder {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let leftGreater = false;
  let rightGreater = false;

  for (const key of keys) {
    const leftValue = counter(left, key);
    const rightValue = counter(right, key);
    if (leftValue > rightValue) leftGreater = true;
    else if (rightValue > leftValue) rightGreater = true;
  }

  if (leftGreater && rightGreater) return 'CONCURRENT';
  if (leftGreater) return 'AFTER';
  if (rightGreater) return 'BEFORE';
  return 'EQUAL';
}
