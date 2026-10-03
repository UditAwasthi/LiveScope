import { EventRiver, GyroRings, LoopOrbit, MetalSolid, PlaneStack, PointGlobe, SteelCage, SteelContours } from '@/components/three';
import { LoopRail } from './components/LoopRail';
import { RecoveryGraph } from './components/RecoveryGraph';
import { Wordmark } from './components/Wordmark';

const REPO = 'https://github.com/UditAwasthi/LiveScope';
const DOCS = `${REPO}/tree/main/docs`;
const doc = (file: string) => `${REPO}/blob/main/docs/${file}`;

const NAV = [
  ['#limit', 'The limit'],
  ['#loop', 'The loop'],
  ['#fix-lab', 'Fix Lab'],
  ['#safety', 'Safety'],
  ['#architecture', 'Architecture'],
  ['#status', 'Status'],
] as const;

export default function HomePage() {
  return (
    <div className="grain">
      <Nav />
      <main>
        <Hero />
        <Beats />
        <Loop />
        <FixLab />
        <Safety />
        <Architecture />
        <Status />
      </main>
      <Footer />
    </div>
  );
}

/* ───────────────────────── Nav ───────────────────────── */

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-bg/85 backdrop-blur-md">
      <div className="rule-glint" />
      <div className="mx-auto flex h-16 max-w-page items-center justify-between px-6">
        <a href="#top" aria-label="LiveScope home">
          <Wordmark size="nav" />
        </a>
        <nav className="hidden items-center gap-8 text-sm text-ink-2 lg:flex">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="transition-colors hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <a href={REPO} className="btn-steel !h-9 !px-4 text-[13px]" target="_blank" rel="noreferrer">
          GitHub <span aria-hidden>↗</span>
        </a>
      </div>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-page px-6 pb-20 pt-16 md:pt-24">
      <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
        <span className="label">Part 1 · Distributed developer observability</span>
        <span className="font-mono text-[12px] text-ink-2">event-sourced · CQRS · Kafka · Redis · Avro</span>
      </div>

      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="max-w-[16ch] font-serif text-[44px] leading-[1.05] tracking-[-0.015em] text-ink md:text-[60px] xl:text-[68px]">
            Every observability tool stops at the <span className="text-failure">red graph</span>.
          </h1>
          <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-ink-2 md:text-xl">
            LiveScope keeps going. It reconstructs the incident from real telemetry, reproduces it in an isolated Fix Lab, attempts the
            safest fix, verifies recovery in live data — and rolls back if things get worse.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href={DOCS} className="btn-chrome" target="_blank" rel="noreferrer">
              Read the documentation
            </a>
            <a href="#limit" className="btn-steel">
              See how it works <span aria-hidden>↓</span>
            </a>
          </div>
        </div>

        {/* The object: nested steel gimbal rings. Drag to spin. */}
        <div className="lg:col-span-5">
          <div className="steel-lg relative aspect-square overflow-hidden">
            <div className="absolute inset-0 opacity-70">
              <SteelContours opacity={0.22} scale={2.2} />
            </div>
            <div className="absolute inset-0">
              <GyroRings rings={5} spin={0.9} />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4 font-mono text-[11px] text-ink-2">
              <span>system twin · live</span>
              <span>drag to spin</span>
            </div>
          </div>
        </div>
      </div>

      <figure className="well mt-20 p-6 md:p-10">
        <RecoveryGraph />
        <figcaption className="mt-6 flex flex-wrap justify-between gap-3 font-mono text-[12px] text-ink-2">
          <span>
            <span className="text-failure">■</span> incident &nbsp;
            <span className="text-healthy">■</span> verified recovery &nbsp;
            <span className="text-accent">╌</span> rollback path, armed and not needed
          </span>
          <span>checkout-api · payments-external timeout · demo scenario 4</span>
        </figcaption>
      </figure>
    </section>
  );
}

/* ───────────────────────── 01 · The four beats ───────────────────────── */

const BEATS = [
  {
    word: 'Observe',
    body: 'Rewind the event log to the failure. The causal chain is reconstructed from the stream itself, not from a guess.',
    code: ['offset 48,213 → 48,291', '78 events · 3.9s · payment.failed'],
    tone: 'text-ink-2',
  },
  {
    word: 'Reproduce',
    body: 'Replay those events in a sandbox until the incident happens again, on purpose.',
    code: ['$ livescope replay inc_4a2c', '✗ payment.failed reproduced'],
    tone: 'text-failure',
  },
  {
    word: 'Fix',
    body: 'Candidate fixes are tried where they cannot hurt anyone, then compared on evidence.',
    code: ['- timeoutMs: 2000,  retries: 0', '+ timeoutMs: 800,   retries: 2'],
    tone: 'text-healthy',
  },
  {
    word: 'Verify',
    body: 'No fix is successful because a command returned 200. Recovery has to show up in live telemetry.',
    code: ['error_rate < 1% · 5 min → RESOLVED', 'otherwise → rollback'],
    tone: 'text-accent',
  },
] as const;

function Beats() {
  return (
    <Section id="limit" index="01" title="Observe. Reproduce. Fix. Verify." lede="Four beats. Most tools finish after the first.">
      {/* The event stream, as metal. One in forty rides in red. Hover to slow it down. */}
      <div className="steel-lg relative mb-4 h-[220px] overflow-hidden md:h-[260px]">
        <EventRiver />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4 font-mono text-[11px] text-ink-2">
          <span>metrics.raw · partition 3 · offset 48,213 →</span>
          <span>hover to rewind</span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BEATS.map((b, i) => (
          <article key={b.word} className="steel flex flex-col p-7">
            <span className="label">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="mt-6 font-serif text-[34px] leading-none text-accent">{b.word}</h3>
            <p className="mt-5 text-[15px] leading-relaxed text-ink-2">{b.body}</p>
            <pre className="well mt-8 overflow-hidden whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-6 text-ink-2">
              <span className="block text-ink">{b.code[0]}</span>
              <span className={`block ${b.tone}`}>{b.code[1]}</span>
            </pre>
          </article>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── 02 · The loop ───────────────────────── */

const PILLARS = [
  {
    title: 'System Twin',
    body: 'A continuously updated, provenance-tracked model of services, dependencies, deployments, configuration and history — queryable at “now” or at any past timestamp.',
    docFile: '04-system-twin.md',
    docLabel: 'docs/04',
  },
  {
    title: 'Fix Lab',
    body: 'Candidate fixes are evaluated in isolation before production is touched: counterfactual replay, incident traffic replay, sandbox execution — compared on recovery, risk, blast radius, cost and calibrated confidence.',
    docFile: '05-fix-lab.md',
    docLabel: 'docs/05',
  },
  {
    title: 'Evidence-grounded AI',
    body: 'Every diagnosis cites the exact metrics, logs, traces and changes that support it. Competing hypotheses are generated and actively refuted.',
    docFile: '06-ai-architecture.md',
    docLabel: 'docs/06',
  },
] as const;

function Loop() {
  return (
    <Section id="loop" index="02" title="The loop every tool leaves open." lede="Detection is a solved problem. Diagnosis is not — and everything after it is still manual work under time pressure.">
      <div className="steel-lg p-8 md:p-10">
        <LoopRail />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PILLARS.map((p) => (
          <article key={p.title} className="steel flex flex-col p-7">
            <h3 className="font-serif text-[26px] text-ink">{p.title}</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{p.body}</p>
            <a href={doc(p.docFile)} target="_blank" rel="noreferrer" className="label mt-10 inline-flex items-center gap-2 self-start text-ink hover:text-accent">
              {p.docLabel} <span aria-hidden>→</span>
            </a>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="steel flex flex-col justify-between p-8 lg:col-span-7">
          <span className="label">What the system answers</span>
          <p className="mt-10 font-serif text-[26px] leading-snug text-ink md:text-[32px]">
            What is broken? <span className="text-ink-2">Why?</span> What happens if we change X? <span className="text-ink-2">Which fix is safest?</span>{' '}
            <span className="text-accent">Did it actually work?</span>
          </p>
          <p className="mt-10 text-[15px] leading-relaxed text-ink-2">
            The two dull nodes on the track are detection — the part every tool does. The nine polished ones are the rest of the loop. The carriage runs all of it.
          </p>
        </div>
        {/* The loop as an object. Drag to turn. */}
        <div className="steel-lg relative min-h-[360px] overflow-hidden lg:col-span-5">
          <LoopOrbit />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4 font-mono text-[11px] text-ink-2">
            <span>11 stages · one incident</span>
            <span>drag to turn</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────── 03 · Fix Lab ───────────────────────── */

const CANDIDATES = [
  { id: 'A', change: 'rollback checkout-api → v2.14.2', experiment: 'counterfactual + replay', recovery: 'high', risk: 'low', blast: 'checkout-api + 2 dependents', verdict: 'viable' },
  { id: 'B', change: 'config db.pool.max 10 → 50', experiment: 'counterfactual + replay', recovery: 'high', risk: 'low', blast: 'checkout-api only', verdict: 'selected' },
  { id: 'C', change: 'scale replicas ×3', experiment: 'counterfactual', recovery: 'partial', risk: 'medium', blast: 'masks the cause', verdict: 'rejected' },
] as const;

const LADDER = [
  ['Counterfactual', 'Based on the reconstructed incident, this change would likely have prevented the degradation. Lowest cost, always available.'],
  ['Replay', 'The incident is re-run against the change and the outcome observed.'],
  ['Sandbox', 'The change runs in an isolated environment with real workloads, and is measured.'],
  ['Shadow', 'Production-shaped traffic runs against the candidate next to the current version; the two are compared.'],
] as const;

function FixLab() {
  return (
    <Section id="fix-lab" index="03" title="Beliefs become evidence in the Fix Lab." lede="An AI that believes a fix will work is a hypothesis generator. An AI that demonstrates it — in isolation, against reconstructed conditions, with measured outcomes — is a reliability system.">
      <div className="grid gap-4 lg:grid-cols-12">
        {/* The solid: take the candidate apart, look, put it back. */}
        <div className="steel-lg relative min-h-[320px] overflow-hidden lg:col-span-4">
          <MetalSolid />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4 font-mono text-[11px] text-ink-2">
            <span>candidate B · isolated</span>
            <span>hover to inspect</span>
          </div>
        </div>

        <div className="well overflow-x-auto p-2 lg:col-span-8">
          <table className="w-full min-w-[760px] border-collapse font-mono text-[13px]">
            <thead>
              <tr className="text-left">
                {['', 'candidate fix', 'experiment', 'recovery', 'risk', 'blast radius', ''].map((h, i) => (
                  <th key={i} className="label border-b border-rule px-4 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CANDIDATES.map((c) => {
                const selected = c.verdict === 'selected';
                const rejected = c.verdict === 'rejected';
                return (
                  <tr key={c.id} className={`border-b border-rule last:border-b-0 ${rejected ? 'text-muted' : 'text-ink'} ${selected ? 'bg-white/[0.025]' : ''}`}>
                    <td className="w-10 px-4 py-4">
                      <span className={selected ? 'text-accent' : ''}>{c.id}</span>
                    </td>
                    <td className="px-4 py-4">{c.change}</td>
                    <td className="px-4 py-4 text-ink-2">{c.experiment}</td>
                    <td className={`px-4 py-4 ${c.recovery === 'high' && !rejected ? 'text-healthy' : ''}`}>{c.recovery}</td>
                    <td className={`px-4 py-4 ${c.risk === 'medium' ? 'text-failure' : ''}`}>{c.risk}</td>
                    <td className="px-4 py-4">{c.blast}</td>
                    <td className="px-4 py-4 text-right">
                      {selected ? (
                        <span className="inline-flex items-center gap-2 text-accent">
                          <span className="inline-block h-[6px] w-[6px] rounded-full bg-accent" /> selected
                        </span>
                      ) : (
                        <span className="text-ink-2">{c.verdict}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 pb-3 pt-4 font-mono text-[12px] text-ink-2">
            demo scenario 1 · deployment regression · pool.max 50 → 10 shipped in v2.14.3 · see{' '}
            <a href={doc('17-demo-scenarios.md')} className="link" target="_blank" rel="noreferrer">
              docs/17
            </a>
          </p>
        </div>
      </div>

      <div className="mt-20 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <h3 className="font-serif text-[26px] text-ink">Four guarantees, in increasing strength.</h3>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Production is never modified by a Fix Lab experiment. Every experiment writes to isolated resources tagged with its id; teardown is guaranteed.
          </p>
        </div>
        <ol className="md:col-span-8">
          {LADDER.map(([name, body], i) => (
            <li key={name} className="grid grid-cols-[48px_1fr] gap-6 border-t border-rule py-6 last:border-b">
              <span className="chrome-text font-serif text-[22px] leading-none">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="text-ink">{name}</div>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

/* ───────────────────────── 04 · Safety ───────────────────────── */

const LEVELS = ['OBSERVE_ONLY', 'ASSISTED', 'APPROVAL_REQUIRED', 'AUTO_SAFE'] as const;

const RULES = [
  ['The LLM never holds production credentials.', 'Mutating actions run in a deterministic executor with per-execution, scoped, short-lived credentials.'],
  ['Destructive operations do not exist in the tool registry.', 'The denylist is structural, not a prompt.'],
  ['Telemetry, logs and commits are data, never instructions.', 'Prompt-injection resistance is benchmark-gated.'],
  ['A 200 is not a success.', 'Recovery must be observed in live telemetry, with automatic rollback otherwise.'],
  ['Autonomy is promoted only on measured evaluation history.', 'Humans set the policy. AUTONOMOUS is explicitly not on the roadmap.'],
] as const;

function Safety() {
  return (
    <Section id="safety" index="04" title="Safety is the architecture, not a setting." lede="AI agents that modify production based on belief are a liability. LiveScope’s core idea is to demonstrate a fix works before proposing it — with measured evidence and a rollback path.">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 font-mono text-[13px]">
        {LEVELS.map((l, i) => (
          <span key={l} className="inline-flex items-center gap-3">
            <span className="steel px-3 py-1.5 text-ink">{l}</span>
            {i < LEVELS.length - 1 ? <span className="text-muted">→</span> : null}
          </span>
        ))}
        <span className="ml-2 text-muted line-through decoration-failure/70">AUTONOMOUS</span>
        <span className="label">not on the roadmap</span>
      </div>

      <div className="mt-14 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ul className="border-t border-rule">
            {RULES.map(([head, body], i) => (
              <li key={head} className="grid gap-2 border-b border-rule py-6 md:grid-cols-12 md:gap-6">
                <span className="chrome-text font-serif text-[22px] leading-none md:col-span-1">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-serif text-[22px] leading-snug text-ink md:col-span-6">{head}</span>
                <span className="text-[15px] leading-relaxed text-ink-2 md:col-span-5">{body}</span>
              </li>
            ))}
          </ul>
          <a href={doc('08-safety-and-autonomy.md')} className="label mt-8 inline-flex items-center gap-2 text-ink hover:text-accent" target="_blank" rel="noreferrer">
            docs/08 · safety and autonomy <span aria-hidden>→</span>
          </a>
        </div>
        {/* Bounded capability: the core never leaves the cage. */}
        <div className="steel-lg relative min-h-[360px] overflow-hidden lg:col-span-4 lg:sticky lg:top-24 lg:self-start lg:aspect-[4/5]">
          <SteelCage />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4 font-mono text-[11px] text-ink-2">
            <span>AI plane · zero standing credentials</span>
            <span>bounded</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────── 05 · Architecture ───────────────────────── */

const PLANES = [
  { name: 'Data plane', trust: 'low trust · high volume', body: 'Telemetry ingestion and processing. All telemetry is untrusted input. SDK and OpenTelemetry in; Kafka + Avro through; projections, streams and anomaly detection out.' },
  { name: 'Control plane', trust: 'highest trust', body: 'Organisations, policies, approvals, audit. The only granter of AI permissions.' },
  { name: 'AI plane', trust: 'bounded capability', body: 'Investigation, Fix Lab, planning. Zero standing credentials, registry-scoped tools only.' },
] as const;

const PIPELINE = ['SDK / OTLP', 'Ingestion', 'Kafka + Avro', 'Processing', 'System Twin', 'Incident Engine', 'AI control plane', 'Fix Lab', 'Policy / approval', 'Action Engine', 'Dashboard'];

function Architecture() {
  return (
    <Section id="architecture" index="05" title="Three planes, three trust levels." lede="Event-sourced and CQRS by construction: every projection can be rebuilt from the stream, and the stream is what the Fix Lab replays.">
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Three plates, three trust levels. Hover lifts them apart. */}
        <div className="steel-lg relative min-h-[380px] overflow-hidden lg:col-span-5">
          <PlaneStack />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4 font-mono text-[11px] text-ink-2">
            <span>data · control · AI</span>
            <span>hover to separate</span>
          </div>
        </div>
        <div className="grid gap-4 lg:col-span-7">
          {PLANES.map((p) => (
            <article key={p.name} className="steel flex flex-col justify-center p-7">
              <span className="label">{p.trust}</span>
              <h3 className="mt-3 font-serif text-[26px] text-ink">{p.name}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{p.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="well mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 px-6 py-5 font-mono text-[12.5px] text-ink-2">
        {PIPELINE.map((step, i) => (
          <span key={step} className="inline-flex items-center gap-2">
            <span className={step === 'Fix Lab' || step === 'Action Engine' ? 'text-ink' : ''}>{step}</span>
            {i < PIPELINE.length - 1 ? <span className="text-muted">→</span> : null}
          </span>
        ))}
      </div>
      <a href={doc('03-system-overview.md')} className="label mt-8 inline-flex items-center gap-2 text-ink hover:text-accent" target="_blank" rel="noreferrer">
        docs/03 · system overview <span aria-hidden>→</span>
      </a>
    </Section>
  );
}

/* ───────────────────────── 06 · Status ───────────────────────── */

const STATUS = [
  ['Monorepo · Turborepo + pnpm + TypeScript (strict)', 'implemented'],
  ['Local infra · Kafka, Zookeeper, Schema Registry, Redis, Postgres (Docker Compose)', 'implemented'],
  ['Event schemas · Avro METRIC_RECORDED, serializer, TS types', 'implemented'],
  ['Gateway · ingest API, DLQ, circuit breaker, /healthz, gRPC BatchEvents', 'implemented'],
  ['SDK, vector clock, CRDT, diff engine, query engine', 'implemented · tested'],
  ['Projection, stream, anomaly, chaos, region, dashboard', 'implemented · in-process'],
  ['System Twin, incidents, investigation, Fix Lab, approvals, rollback, forecast', 'implemented · six-scenario suite'],
  ['Rules investigator cites telemetry; no external model call yet', 'current'],
  ['Live Kafka demo end-to-end', 'next'],
] as const;

function Status() {
  return (
    <Section id="status" index="06" title="Early in construction. Honestly." lede="What exists today versus what is planned. The scenario suite is the regression gate; the reliability loop is evidence-gated and policy-gated in code.">
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Telemetry as a globe: steel points, healthy green, a few failures recovering. */}
        <div className="steel-lg relative min-h-[360px] overflow-hidden lg:col-span-4">
          <PointGlobe />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4 font-mono text-[11px] text-ink-2">
            <span>1,400 series · 4 regions</span>
            <span>drag to turn</span>
          </div>
        </div>
        <ul className="well px-6 lg:col-span-8">
          {STATUS.map(([what, state]) => {
            const done = state.startsWith('implemented');
            return (
              <li key={what} className="flex items-baseline justify-between gap-6 border-b border-rule py-4 last:border-b-0">
                <span className="text-[15px] text-ink">{what}</span>
                <span className={`shrink-0 font-mono text-[12px] ${done ? 'text-healthy' : state === 'next' ? 'text-accent' : 'text-ink-2'}`}>
                  {done ? '● ' : '○ '}
                  {state}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
        {[
          [`${REPO}/blob/main/BUILD-PLAN.md`, 'build plan'],
          [doc('18-roadmap.md'), 'docs/18 · roadmap'],
          [doc('19-architecture-decisions.md'), 'docs/19 · architecture decisions'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="label inline-flex items-center gap-2 text-ink hover:text-accent" target="_blank" rel="noreferrer">
            {label} <span aria-hidden>→</span>
          </a>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  return (
    <footer className="mt-32 border-t border-rule">
      <div className="rule-glint" />
      {/* The title card in steel: chrome wordmark on the green baseline, contours behind. */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <SteelContours opacity={0.28} scale={1.8} speed={0.8} />
        </div>
        <div className="relative mx-auto flex max-w-page flex-col items-center px-6 pb-16 pt-28 text-center">
          <Wordmark size="footer" chrome />
          <div className="mt-[-8px] h-[2px] w-full max-w-[760px] bg-healthy" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.6)' }} />
          <p className="mt-7 font-mono text-[15px] tracking-[0.02em] text-ink-2">Observe. Reproduce. Fix. Verify.</p>
        </div>
      </div>

      <div className="mx-auto max-w-page px-6">
        <div className="flex flex-col gap-6 border-t border-rule py-8 text-[13px] text-ink-2 md:flex-row md:items-center md:justify-between">
          <span>Part 1 · Distributed developer observability</span>
          <nav className="flex flex-wrap gap-x-8 gap-y-2">
            <a href={REPO} className="hover:text-ink" target="_blank" rel="noreferrer">GitHub</a>
            <a href={DOCS} className="hover:text-ink" target="_blank" rel="noreferrer">Documentation</a>
            <a href={doc('01-product-vision.md')} className="hover:text-ink" target="_blank" rel="noreferrer">Product vision</a>
            <a href={doc('20-non-goals.md')} className="hover:text-ink" target="_blank" rel="noreferrer">Non-goals</a>
          </nav>
          <span className="font-mono text-[12px]">MIT</span>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── Shared ───────────────────────── */

function Section({ id, index, title, lede, children }: { id: string; index: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-page scroll-mt-24 px-6 py-24 md:py-32">
      <div className="mb-14 grid gap-6 md:grid-cols-12">
        <span className="chrome-text font-serif text-[28px] leading-none md:col-span-1">{index}</span>
        <h2 className="font-serif text-[36px] leading-[1.1] tracking-[-0.01em] text-ink md:col-span-6 md:text-[48px]">{title}</h2>
        <p className="text-[17px] leading-relaxed text-ink-2 md:col-span-5 md:pt-2">{lede}</p>
      </div>
      {children}
    </section>
  );
}
