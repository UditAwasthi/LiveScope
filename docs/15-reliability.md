# 15 — Reliability Architecture

> Status: `[PROPOSED]` unless noted. How LiveScope survives its own failures. LiveScope's reliability posture must match its product claims — a reliability platform that loses incidents during a Kafka blip is self-refuting.

## Principles

1. **Detection never depends on the AI plane.** Threshold/EWMA detection and incident creation are deterministic; the LLM provider being down degrades to "human investigates with our dashboards," never to "no alerting."
2. **Nothing silently disappears.** Rejected events → DLQ; dropped diffs → coalescing counters; failed actions → rollback receipts; everything is either delivered or accounted for.
3. **Recover by replay.** Event-sourced state (snapshot + replay) makes crash recovery deterministic rather than heroic.
4. **Fail safe, escalate loudly.** The AI plane's failure mode is `ESCALATED` to humans with evidence preserved ([09-incident-engine.md](09-incident-engine.md)), never silent inaction.

## Failure catalog & recovery strategies

### Infrastructure

**Kafka failure**
- Gateway: circuit breaker open → SDKs buffer client-side up to cap, then drop-oldest with counters ([11-sdk-and-ingestion.md](11-sdk-and-ingestion.md)); gateway health reflects degraded ingestion on the dashboard.
- Consumers (projection, anomaly): stop cleanly; on broker return, resume from committed offsets; projection catches up via snapshot + replay if lag exceeds a threshold.
- DLQ consumer is independent; DLQ never blocks the main path.
- Metrics: `ingest_dropped_total`, `ingest_buffer_utilization`, consumer lag — alertable on LiveScope itself (dogfooding, [18-roadmap.md](18-roadmap.md) Phase 2).

**Redis failure (hot state / pub-sub)**
- Live dashboard state degrades to query-polling fallback (queries hit the event store directly — slower but correct).
- Pub/Sub loss → stream engine re-sources from Kafka; consumers are designed to be re-derivable (Redis is a cache, never the source of truth).
- Recovery: rebuild hot state from event store replay (bounded by snapshot cadence).

**Database failure (event store / Timescale / Postgres)**
- Ingestion continues into Kafka (Kafka is the durable buffer); processing backpressures; **telemetry is never lost while Kafka retains it** (7-day retention gives a generous recovery window).
- Control-plane (Postgres) failure freezes the AI plane (no plan validation, no approvals) — fail-safe; detection continues via the telemetry path with its own store.

**Ingestion overload**
- Per-key quotas + backpressure at the gateway; SDK buffers absorb bursts; overload shed order: sampling of high-cardinality metrics first, logs second, **traces-errors and alert-generating signals last**.
- Coalescing in the stream engine (drop stale NORMAL diffs, keep latest per entity; never drop HIGH/alert lane) — as designed in [BUILD-PLAN.md](../BUILD-PLAN.md) Phase 4.

### AI plane

**Agent failure (orchestrator crash/timeout/budget exhaustion)**
- Incident → `ESCALATED` with partial evidence and timeline entries intact ([09-incident-engine.md](09-incident-engine.md)).
- Agent executions are resumable-by-record, not by memory: a re-run investigation starts fresh with the recorded evidence packet as prior context.

**Experiment failure**
- Fix Lab experiments are budgeted and TTL-bound: any failure mode (sandbox crash, workload error, timeout) → `ABORTED` + guaranteed teardown; the incident proceeds with remaining candidates or escalates.
- Experiment failure is *recorded outcome*, not data loss ([05-fix-lab.md](05-fix-lab.md) § Fail-safe behaviors).

**Action failure (mid-remediation)**
- Plan steps are individually gated: before/after state captured per step; step failure triggers the **pre-declared rollback path** for already-applied steps, in reverse order.
- Partially-completed remediation is a first-class state: `ROLLING_BACK` → rollback receipt per step → incident `FAILED`/`ESCALATED` with exact world-state delta (what was applied, what was rolled back, what remains).
- Action Engine is idempotent per step (step id + before-state fingerprint): a crashed executor resumes by re-validating actual world state vs recorded, never blind re-execution.

**Verification failure**
- Criteria not met in window → automatic rollback (Rule 9) — [09-incident-engine.md](09-incident-engine.md) `VERIFYING → ROLLING_BACK`.
- Verification machinery itself down → actions pause at safe checkpoints (between steps); no plan completes without verification evidence. Unverified "success" is labeled `UNVERIFIED` and never silently resolves an incident.

### Data correctness

**Duplicate events**
- Idempotency: UUIDv4 event ids (SDK) + idempotent Kafka producer + vector-clock merge at projection (drops causally-old duplicates) — the existing design intent, [BUILD-PLAN.md](../BUILD-PLAN.md) Phase 3, retained and tested with property tests.

**Network partition (multi-region `[FUTURE]`)**
- Region-tagged events; CRDT (GCounter/PNCounter) state merges on reconnection (the `crdt` package design); divergence surfaced on the dashboard, convergence after heal — mirrors the original region-simulator demo intent ([19-architecture-decisions.md](19-architecture-decisions.md)).

**Stale System Twin**
- Freshness labels are mandatory on every Twin fact; AI reasoning must flag stale-fact reliance ([04-system-twin.md](04-system-twin.md) § 5); consistency validator flags contradictions; degraded-confidence mode propagates to experiment confidence caps.

**Poison messages / malformed payloads**
- Gateway validates first (schema, size) → reject to DLQ with reason; DLQ has its own consumer + review tooling; poison messages can never loop the main path (no infinite retry on the hot path; bounded retries then DLQ).

## Recovery targets

| Scenario | Target | Mechanism |
|---|---|---|
| Projection engine crash | state recovered < 5s after restart | snapshot + replay from committed offsets |
| Kafka restart | no telemetry loss (within retention), catch-up < 1 min for 10-min outage | durable log + consumer offsets |
| Redis flush | hot state rebuilt from event store | replay |
| AI provider outage | detection unaffected; incidents ESCALATED with evidence | deterministic detection path |
| Mid-plan executor crash | no double-apply, no half-world-state ambiguity | step idempotency + before-state fingerprints |
| Sandbox leak | zero leaked resources per 100 experiments | TTL + label sweep + teardown receipts |

## Self-observability (dogfooding)

LiveScope instruments itself with its own SDK from Phase 1 onward: ingestion lag, DLQ depth, consumer lag, experiment teardown success, action rollback counts — visible in its own dashboard and used in its own incident engine. The benchmark suite ([16-ai-evaluation.md](16-ai-evaluation.md)) uses these self-incidents as extra scenarios: "LiveScope detected and diagnosed its own Kafka lag."

## Related documents

State machines: [09-incident-engine.md](09-incident-engine.md) · Storage roles: [10-data-model.md](10-data-model.md) · Fix Lab fail-safes: [05-fix-lab.md](05-fix-lab.md) · Tech tradeoffs: [19-architecture-decisions.md](19-architecture-decisions.md)