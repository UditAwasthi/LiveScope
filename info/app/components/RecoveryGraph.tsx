/**
 * The hero visual: the same incident as the Part 1 film.
 * p99 sits on a red plateau, a fix is applied, the line returns to the green
 * baseline, and the rollback path is drawn as the dashed branch it would have
 * taken if the error rate had risen instead. Pure SVG, deterministic.
 */

const W = 1200;
const H = 300;
const PLOT = { left: 0, right: W, top: 36, bottom: 236 };
const Y_MAX = 3000;
const BASELINE = 142;
const FIX_X = 0.42;
const SETTLE_X = 0.62;

const hash = (seed: number) => {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

const smooth = (t: number) => 0.5 * Math.sin(t * 41) + 0.3 * Math.sin(t * 97 + 1) + 0.2 * Math.sin(t * 193 + 2);
const smoothstep = (t: number) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

const ms = (t: number) => {
  const plateau = 2200 + 200 * smooth(t) + 160 * (hash(Math.floor(t * 160)) - 0.5);
  if (t < FIX_X) return plateau;
  const k = smoothstep((t - FIX_X) / (SETTLE_X - FIX_X));
  const healthy = BASELINE + 6 * smooth(t + 3);
  return plateau + (healthy - plateau) * k;
};

const rollback = (t: number) => {
  const k = smoothstep((t - FIX_X) / 0.16);
  return 2200 + 520 * k + 60 * (hash(Math.floor(t * 160) + 99) - 0.5);
};

const px = (t: number) => PLOT.left + t * (PLOT.right - PLOT.left);
const py = (v: number) => PLOT.bottom - (Math.min(Y_MAX, Math.max(0, v)) / Y_MAX) * (PLOT.bottom - PLOT.top);

const path = (from: number, to: number, fn: (t: number) => number, step = 0.004) => {
  const parts: string[] = [];
  for (let t = from; t <= to + 1e-9; t += step) parts.push(`${parts.length ? 'L' : 'M'}${px(t).toFixed(1)} ${py(fn(t)).toFixed(1)}`);
  return parts.join(' ');
};

const SPLIT = FIX_X + 0.08;
const RED = path(0, SPLIT, ms);
const GREEN = path(SPLIT, 1, ms);
const BRANCH = path(FIX_X, FIX_X + 0.17, rollback);
const BASE_Y = py(BASELINE);

export function RecoveryGraph() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Latency graph: a red plateau returns to a green baseline after a fix is applied; the rollback path is shown as a dashed branch.">
      {/* axis */}
      <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom + 0.5} y2={PLOT.bottom + 0.5} stroke="#5F666E" strokeOpacity={0.5} />

      {/* the line */}
      <path d={RED} fill="none" stroke="#D45A49" strokeWidth={1.75} strokeLinejoin="round" />
      <path d={GREEN} fill="none" stroke="#8FA66B" strokeWidth={1.75} strokeLinejoin="round" />

      {/* what rollback would have looked like */}
      <path d={BRANCH} fill="none" stroke="#D97757" strokeWidth={1.5} strokeDasharray="3 7" />

      {/* fix marker */}
      <line x1={px(FIX_X)} x2={px(FIX_X)} y1={PLOT.bottom + 2} y2={PLOT.bottom - 16} stroke="#D97757" strokeWidth={1.5} />

      <g className="font-mono" fontSize={12} letterSpacing="0.02em">
        <text x={px(0.01)} y={PLOT.top - 14} fill="#D45A49">
          ALERT · checkout-api · error rate 38%
        </text>
        <text x={px(FIX_X) + 10} y={PLOT.bottom + 24} fill="#D97757">
          fix applied · 14:09:12
        </text>
        <text x={px(FIX_X + 0.18)} y={py(rollback(FIX_X + 0.17)) - 10} fill="#D97757">
          if error rate rises → rollback
        </text>
        <text x={px(0.99)} y={BASE_Y - 12} textAnchor="end" fill="#8FA66B">
          p99 142ms · errors 0.02% · verified in live telemetry
        </text>
        <text x={px(0.01)} y={PLOT.bottom + 24} fill="#9AA1A9">
          offset 48,213 → 48,291
        </text>
        <text x={px(0.99)} y={PLOT.bottom + 24} textAnchor="end" fill="#9AA1A9">
          +12 min
        </text>
      </g>
    </svg>
  );
}
