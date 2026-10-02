export type FaultKind = 'dropPercent' | 'delayMs' | 'killNode' | 'redisDown';

export interface Fault {
  kind: FaultKind;
  magnitude: number;
  expiresAt: number;
}

export class ChaosEngine {
  private faults: Fault[] = [];
  readonly log: { kind: FaultKind; at: number }[] = [];

  inject(kind: FaultKind, magnitude: number, ttlMs: number, now: number): void {
    this.faults.push({ kind, magnitude, expiresAt: now + ttlMs });
    this.log.push({ kind, at: now });
  }

  active(now: number): Fault[] {
    this.faults = this.faults.filter((fault) => fault.expiresAt > now);
    return this.faults;
  }

  shouldDrop(now: number, roll = Math.random()): boolean {
    const fault = this.active(now).find((item) => item.kind === 'dropPercent');
    if (!fault) return false;
    return roll * 100 < fault.magnitude;
  }

  delayMs(now: number): number {
    return this.active(now).find((item) => item.kind === 'delayMs')?.magnitude ?? 0;
  }

  redisWritable(now: number): boolean {
    return !this.active(now).some((item) => item.kind === 'redisDown');
  }

  killed(now: number): boolean {
    return this.active(now).some((item) => item.kind === 'killNode');
  }
}
