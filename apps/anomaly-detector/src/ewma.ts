export type AnomalySignal = 'ok' | 'raise' | 'ongoing' | 'resolve';

interface Series {
  mean: number;
  variance: number;
  samples: number;
  okStreak: number;
  open: boolean;
}

/** EWMA with a dynamic threshold of 3 standard deviations. */
export class AnomalyDetector {
  private readonly series = new Map<string, Series>();

  constructor(private readonly options: { alpha?: number; warmup?: number; resolveAfter?: number } = {}) {}

  update(key: string, value: number): AnomalySignal {
    const alpha = this.options.alpha ?? 0.2;
    const current = this.series.get(key) ?? { mean: value, variance: 0, samples: 0, okStreak: 0, open: false };
    const warmup = this.options.warmup ?? 5;
    const previousStd = Math.sqrt(current.variance);
    const breach = current.samples > warmup && Math.abs(value - current.mean) > 3 * Math.max(previousStd, 1);
    const delta = value - current.mean;
    const mean = current.samples === 0 ? value : current.mean + alpha * delta;
    const variance = current.samples === 0 ? 0 : (1 - alpha) * (current.variance + alpha * delta * delta);
    const next: Series = { ...current, mean, variance, samples: current.samples + 1 };

    if (breach && !next.open) {
      next.open = true;
      next.okStreak = 0;
      this.series.set(key, next);
      return 'raise';
    }
    if (breach && next.open) {
      next.okStreak = 0;
      this.series.set(key, next);
      return 'ongoing';
    }
    if (next.open) {
      next.okStreak += 1;
      if (next.okStreak >= (this.options.resolveAfter ?? 3)) {
        next.open = false;
        next.okStreak = 0;
        this.series.set(key, next);
        return 'resolve';
      }
    }
    this.series.set(key, next);
    return 'ok';
  }
}
