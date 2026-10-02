const NODE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

function assertNodeId(nodeId: string): void {
  if (!NODE_ID.test(nodeId)) {
    throw new Error(`invalid nodeId: ${nodeId}`);
  }
}

function assertAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('amount must be a non-negative finite number');
  }
}

/** Grow-only counter. Each node increments its own slot; merge takes the max per node. */
export class GCounter {
  private constructor(private readonly counts: Readonly<Record<string, number>>) {}

  static empty(): GCounter {
    return new GCounter({});
  }

  static fromJSON(counts: Readonly<Record<string, number>>): GCounter {
    for (const [nodeId, amount] of Object.entries(counts)) {
      assertNodeId(nodeId);
      assertAmount(amount);
    }
    return new GCounter({ ...counts });
  }

  increment(nodeId: string, amount = 1): GCounter {
    assertNodeId(nodeId);
    assertAmount(amount);
    return new GCounter({
      ...this.counts,
      [nodeId]: (this.counts[nodeId] ?? 0) + amount,
    });
  }

  value(): number {
    return Object.values(this.counts).reduce((sum, count) => sum + count, 0);
  }

  merge(other: GCounter): GCounter {
    const keys = new Set([...Object.keys(this.counts), ...Object.keys(other.counts)]);
    const merged: Record<string, number> = {};
    for (const key of keys) {
      merged[key] = Math.max(this.counts[key] ?? 0, other.counts[key] ?? 0);
    }
    return new GCounter(merged);
  }

  toJSON(): Record<string, number> {
    return { ...this.counts };
  }
}
