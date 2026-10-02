export interface Sample {
  t: number;
  v: number;
}

/** Linear forecast. Returns minutes until `limit` when the slope is positive. */
export function forecastThreshold(series: Sample[], limit: number): { etaMs: number | null; confidence: number } {
  if (series.length < 3) return { etaMs: null, confidence: 0 };
  const n = series.length;
  const meanT = series.reduce((sum, sample) => sum + sample.t, 0) / n;
  const meanV = series.reduce((sum, sample) => sum + sample.v, 0) / n;
  let num = 0;
  let den = 0;
  for (const sample of series) {
    num += (sample.t - meanT) * (sample.v - meanV);
    den += (sample.t - meanT) ** 2;
  }
  if (den === 0) return { etaMs: null, confidence: 0 };
  const slope = num / den;
  if (slope <= 0) return { etaMs: null, confidence: 0.2 };
  const intercept = meanV - slope * meanT;
  const last = series[series.length - 1]!;
  if (last.v >= limit) return { etaMs: 0, confidence: 0.9 };
  const eta = (limit - intercept) / slope;
  const etaMs = eta - last.t;
  if (etaMs < 0) return { etaMs: null, confidence: 0.3 };
  return { etaMs, confidence: Math.min(0.9, 0.5 + series.length / 20) };
}
