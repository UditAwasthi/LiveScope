import { GCounter } from './g-counter';

/** Positive-negative counter. Value is increments minus decrements. */
export class PNCounter {
  private constructor(
    private readonly increments: GCounter,
    private readonly decrements: GCounter,
  ) {}

  static empty(): PNCounter {
    return new PNCounter(GCounter.empty(), GCounter.empty());
  }

  static fromJSON(json: {
    increments: Record<string, number>;
    decrements: Record<string, number>;
  }): PNCounter {
    return new PNCounter(GCounter.fromJSON(json.increments), GCounter.fromJSON(json.decrements));
  }

  increment(nodeId: string, amount = 1): PNCounter {
    return new PNCounter(this.increments.increment(nodeId, amount), this.decrements);
  }

  decrement(nodeId: string, amount = 1): PNCounter {
    return new PNCounter(this.increments, this.decrements.increment(nodeId, amount));
  }

  value(): number {
    return this.increments.value() - this.decrements.value();
  }

  merge(other: PNCounter): PNCounter {
    return new PNCounter(
      this.increments.merge(other.increments),
      this.decrements.merge(other.decrements),
    );
  }

  toJSON(): { increments: Record<string, number>; decrements: Record<string, number> } {
    return {
      increments: this.increments.toJSON(),
      decrements: this.decrements.toJSON(),
    };
  }
}
