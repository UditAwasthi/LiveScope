const STAGES = [
  'Observe',
  'Detect',
  'Investigate',
  'Understand',
  'Reconstruct',
  'Experiment',
  'Compare fixes',
  'Execute',
  'Verify',
  'Rollback if needed',
  'Learn',
] as const;

/** Where every other tool stops. Index into STAGES (exclusive). */
const OTHERS_STOP_AT = 2;

/** The full loop as one horizontal rail. Thin line, ticks, mono labels. */
export function LoopRail() {
  const n = STAGES.length;
  return (
    <div>
      <div className="relative hidden md:block">
        {/* rail */}
        <div className="absolute left-0 right-0 top-[7px] h-px bg-muted/60" />
        {/* the part every tool covers */}
        <div className="absolute left-0 top-[6px] h-[3px] bg-ink" style={{ width: `${((OTHERS_STOP_AT - 0.5) / (n - 1)) * 100}%` }} />
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {STAGES.map((s, i) => {
            const covered = i < OTHERS_STOP_AT;
            return (
              <li key={s} className="flex flex-col items-start gap-4">
                <span className={`block h-[15px] w-px ${covered ? 'bg-ink' : 'bg-accent'}`} />
                <span className="label !text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className={`-mt-3 text-sm leading-tight ${covered ? 'text-ink-2' : 'text-ink'}`}>{s}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-8 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          <div className="label col-span-2 text-ink">Every observability tool</div>
          <div className="label text-accent" style={{ gridColumn: `${OTHERS_STOP_AT + 1} / -1` }}>
            LiveScope
          </div>
        </div>
      </div>

      {/* Narrow screens: vertical list */}
      <ol className="md:hidden border-l border-muted/60">
        {STAGES.map((s, i) => {
          const covered = i < OTHERS_STOP_AT;
          return (
            <li key={s} className="relative flex items-baseline gap-4 py-2 pl-5">
              <span className={`absolute -left-px top-1/2 h-px w-3 ${covered ? 'bg-ink' : 'bg-accent'}`} />
              <span className="label text-muted">{String(i + 1).padStart(2, '0')}</span>
              <span className={covered ? 'text-ink-2' : 'text-ink'}>{s}</span>
              {i === OTHERS_STOP_AT - 1 ? <span className="label ml-auto">← others stop</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
