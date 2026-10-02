const NODE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

export interface LWWState<T> {
  value: T;
  timestamp: number;
  nodeId: string;
}

function assertNodeId(nodeId: string): void {
  if (!NODE_ID.test(nodeId)) {
    throw new Error(`invalid nodeId: ${nodeId}`);
  }
}

function assertTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp)) {
    throw new Error('timestamp must be finite');
  }
}

function valueRank(value: unknown): string {
  return JSON.stringify(value) ?? '';
}

function beats<T>(candidate: LWWState<T>, current: LWWState<T>): boolean {
  if (candidate.timestamp !== current.timestamp) {
    return candidate.timestamp > current.timestamp;
  }
  if (candidate.nodeId !== current.nodeId) {
    return candidate.nodeId > current.nodeId;
  }
  return valueRank(candidate.value) > valueRank(current.value);
}

/**
 * Last-write-wins register.
 * Higher timestamp wins. Equal timestamps break ties by nodeId, then by JSON value.
 */
export class LWWRegister<T> {
  private constructor(private readonly state: LWWState<T> | undefined) {}

  static empty<T>(): LWWRegister<T> {
    return new LWWRegister<T>(undefined);
  }

  static of<T>(value: T, timestamp: number, nodeId: string): LWWRegister<T> {
    assertTimestamp(timestamp);
    assertNodeId(nodeId);
    return new LWWRegister({ value, timestamp, nodeId });
  }

  get(): LWWState<T> | undefined {
    return this.state ? { ...this.state } : undefined;
  }

  set(value: T, timestamp: number, nodeId: string): LWWRegister<T> {
    return this.merge(LWWRegister.of(value, timestamp, nodeId));
  }

  merge(other: LWWRegister<T>): LWWRegister<T> {
    if (!this.state) return other;
    if (!other.state) return this;
    return beats(other.state, this.state) ? other : this;
  }
}
