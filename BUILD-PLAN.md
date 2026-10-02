# LiveScope — Build Plan: From Scaffolding to Usable System

> **Goal:** turn the current repo state (2 working pieces, 13 empty packages) into a runnable, demo-able
> real-time observability platform. Each phase ends with something you can **see working**.
> Work top-to-bottom. Do not skip steps within a phase.
>
> **Phase 0 status:** done. Gate is `pnpm lint && pnpm build && pnpm test` with no infrastructure.
> Phases 1–8 of the roadmap are implemented as tested in-process modules: ingestion, projection, streaming, dashboard state, anomaly/chaos/region, and the reliability loop in `@livescope/reliability` (incidents, twin, investigation, Fix Lab, approval, execution, verification, rollback, kill switch, forecast).
> Live Kafka, Redis, and Postgres are in `infra/docker-compose.yml`. Unit tests do not require them.
> `docs/` stays gitignored on purpose. `pnpm-lock.yaml` is also gitignored, so CI installs from package.json ranges.

---

## Current State Audit (as of Oct 2026)

| Component | Status |
|---|---|
| `infra/docker-compose.yml` | ✅ Kafka + Schema Registry (no Mongo/Redis/Timescale yet) |
| `packages/event-schemas` | ✅ Avro schema, serializer, types |
| `apps/gateway` | ✅ Ingest, DLQ, circuit breaker, `/healthz`, gRPC `BatchEvents`, OTLP JSON subset |
| `packages/sdk` | ✅ `LiveScopeClient` buffer, flush, vector clock |
| `packages/vector-clock` | ✅ `tick` / `merge` / `compare` + property tests |
| `packages/crdt` | ✅ `GCounter`, `PNCounter`, `LWWRegister` + property tests |
| `packages/diff-engine` | ✅ `diff` / `applyPatch` + round-trip property tests |
| `packages/query-engine` | ✅ Filter parser and evaluator |
| `packages/utils` | ✅ Logger, retry, circuit breaker, health check, JWT |
| `packages/reliability` | ✅ Incident machine, twin, Fix Lab, action engine, forecast, six scenarios |
| Apps | ✅ Projection, stream, anomaly, chaos, region, websocket auth, dashboard |

**Definition of "usable":** `docker compose up` + `pnpm dev` gives you a live dashboard
streaming real events from an SDK-instrumented demo service, with alerts and time-travel replay working.

---

## Phase 0 — Foundation (½ day)

**Goal: every package builds, tests, and lints. Never build on red CI.**

- [x] 0.1 Add a minimal `src/index.ts` with a real (not placeholder) export to every empty package:
  - `packages/utils`: `createLogger(name)` — JSON console logger with level + timestamps.
  - `packages/vector-clock`, `packages/crdt`, `packages/diff-engine`: full implementations (see Phase 1.1–1.3), not skeletons.
  - Every other package and app: a real `VERSION` or `SERVICE` export so the build has something to compile.
- [x] 0.2 Root `tsconfig.base.json`: `strict: true`, `declaration: true`, `outDir: dist`, plus unused-local and fallthrough checks. `composite` stays off until packages use project references.
- [x] 0.3 Add `lint` (`tsc --noEmit`) and `test` (vitest) scripts to every workspace package, with at least one test each.
- [x] 0.4 **Acceptance gate:** `pnpm lint && pnpm build && pnpm test` passes from a clean clone. Unit tests do not need Docker. Kafka comes back in Phase 2.
- [x] 0.5 GitHub Actions (`.github/workflows/ci.yml`) runs lint, build, and test on push to `main` and on pull requests.
- [x] 0.6 Removed `packages/event-schemas/src/test-register_temp.ts`. It dialed Schema Registry on import and was not a test. Schema registration coverage waits for Phase 1.4.

---

## Phase 1 — The Core Packages (2–3 days)

**Goal: the shared libraries that everything else depends on. These must be correct — test them like math.**

### 1.1 `packages/vector-clock`
- [x] `tick(clock, nodeId)` → increments node's counter.
- [x] `merge(a, b)` → element-wise max.
- [x] `compare(a, b)` → returns `'EQUAL' | 'BEFORE' | 'AFTER' | 'CONCURRENT'`.
- [x] **Property tests (fast-check):** merge is commutative, associative, idempotent; `tick` always yields a clock strictly `AFTER` the original.
- [x] Unit tests: all 4 comparison cases + concurrent branches.

### 1.2 `packages/crdt`
- [x] `GCounter`: `increment(nodeId, amount)`, `value()` (sum of all node counters), `merge()`.
- [x] `PNCounter`: pair of GCounters (`p` increment, `n` decrement), `value() = p - n`.
- [x] `LWWRegister`: last-write-wins with timestamp tiebreak by nodeId, then JSON value.
- [x] **Property tests:** merge of any order of the same updates converges; counters never lose increments when each node writes only its own slot (additivity).

### 1.3 `packages/diff-engine`
- [x] `diff(prev, next)` → shallow + one-level-deep nested diff (only changed keys). Removed keys are the `Deleted` symbol.
- [x] `applyPatch(state, patch)` → returns new state (immutable).
- [x] **Property tests:** `applyPatch(a, diff(a, b))` deep-equals `b` for generated object pairs; diff of identical objects is `{}`.

### 1.4 `packages/event-schemas` (extend existing)
- [x] Add Avro schemas for `LOG_EMITTED`, `SPAN_ENDED`, `ALERT_RAISED` (mirror `metric-recorded.avsc`).
- [x] Register all schemas on startup against Schema Registry (idempotent — same content = same ID). The in-memory registry proves idempotence; the remote client is used when `SCHEMA_REGISTRY_URL` is set.
- [x] Delete `test-register_temp.ts` (done in Phase 0.6; it was a scratch script, not a test).
- [ ] Cover schema registration with a real test once Schema Registry is part of the suite.

### 1.5 `packages/utils`
- [x] `createLogger` (landed in Phase 0).
- [x] `withRetry(fn, {retries, backoffMs})`, `CircuitBreaker` class (closed/open/half-open), `healthCheck` helper.

**Acceptance gate:** all property + unit tests green. These packages are the correctness core — spend the time here; every later phase trusts them blindly.

---

## Phase 2 — Ingestion: SDK + Real Gateway (2–3 days)

**Goal: an instrumented app can push events end-to-end into Kafka.**

### 2.1 `apps/gateway` → real gRPC server
- [x] Define `livescope.proto`: `BatchEvents(stream EventEnvelope) returns (Ack)`.
- [x] Replace the current one-shot script with a long-running gRPC server:
  - validates each event against Avro schema,
  - encodes via `AvroSerializer`,
  - produces to Kafka with **key = `entityId`** (partition ordering per entity),
  - idempotent producer enabled,
  - responds with ack after `producer.send()` resolves.
- [x] Wire `CircuitBreaker` around the Kafka producer: if Kafka is down, reject fast with `UNAVAILABLE`.
- [x] Keep a `/healthz` HTTP endpoint (separate tiny HTTP server) for container probes.

### 2.2 `packages/sdk`
- [x] `LiveScopeClient` class:
  - `metric(name, value, tags?)`, `log(level, message, meta?)`,
  - `trace(name)` → span object with `.tag()` / `.end()`,
  - internal buffer, **auto-flush every 500ms or 100 events** (whichever first),
  - gRPC client connection with reconnect + backoff (`grpcTransport`, `reconnectingTransport`),
  - generates UUIDv4 event IDs and attaches the node's vector clock (ticks per flush).
- [x] **Acceptance test:** SDK → gateway `BatchEvents` round-trip. The test asserts the produced record matches the SDK metric. It uses an in-memory producer so CI does not need a broker. `createKafkaProducer` is the live path when `KAFKA_BROKERS` is set.

### 2.3 `scripts/seed-events.js`
- [x] Configurable: `--services N --events M --interval ms`. Simulated services emit metrics (latency, error rate, RPS) and logs with realistic jitter using the SDK.

**Acceptance gate:** `node scripts/seed-events.js --services 3 --events 1000` streams events; verify with `kafka-console-consumer` (or kcat) that partitioned, Avro-encoded messages land in `metrics.raw`.

---

## Phase 3 — State: Projection Engine + Storage (3–4 days)

**Goal: events become queryable state, and state survives crashes.**

- [x] 3.1 Extend `infra/docker-compose.yml` with a durable store plus **Redis 7** (`redis:7`, port 6379), healthchecks, and `depends_on: condition: service_healthy`. The store is Postgres 16 (ADR-04), initialized from `infra/postgres/001_events.sql`. Redis stays the hot-state cache.
- [x] 3.2 `apps/projection-engine`:
  - Kafka consumer group when `KAFKA_BROKERS` is set; on each event:
    1. merge vector clock (drop causally-old duplicates),
    2. update entity state with **PNCounter/LWWRegister CRDTs** (error count = PNCounter, status = LWWRegister) and publish on the `state` channel (`REDIS_URL` uses Redis Pub/Sub; tests use `MemoryStateBus`),
    3. append the raw event (`DATABASE_URL` writes the Postgres `events` table; tests record the same INSERT),
    4. publish the state change for the stream engine.
- [x] 3.3 Snapshot + replay:
  - snapshot projected state every N events (N = 1000),
  - on startup: load latest snapshot → replay events after the snapshot offset.
- [x] 3.4 Time-travel API on projection-engine: `GET /state?entityId=X&at=<ts>` replays the log up to that timestamp.
- [x] 3.5 **Acceptance test:** `crashAndRecover()` reloads the snapshot and replay and keeps the CRDT counter. That is the in-process stand-in for kill -9; it does not send a real signal to a separate OS process.

---

## Phase 4 — Delivery: Diffs + WebSocket Gateway + Dashboard (3–4 days)

**Goal: the visible payoff — a live dashboard with zero polling.**

### 4.1 `apps/stream-engine`
- [x] Subscribe to state changes (`bindStateBus`; Redis when `REDIS_URL` is set).
- [x] Run each change through `diff-engine` → produce `DiffEvent` (`PATCH`).
- [x] Priority lanes: alerts/anomalies → HIGH queue, metric updates → NORMAL queue.
- [x] Adaptive batching: coalesce NORMAL diffs for the same entity within a 50ms window; never batch HIGH.
- [x] Backpressure: if a subscriber queue exceeds a threshold, drop stale NORMAL diffs (keep latest per entity) — never drop HIGH.
- [x] Compress batches > 1KB. The codec is `node:zlib` deflate, not LZ4, so the package stays free of a native addon.
- [x] Prometheus text on `GET /metrics`: queue depth, coalesced, dropped, batches, compressed.

### 4.2 `apps/websocket-gateway`
- [x] WebSocket server with **JWT auth on handshake** (reject unauthenticated sockets). This is the RFC6455 server in `server.ts`, not a Socket.IO dependency.
- [x] `subscribe { entity, filters?, fields? }` / `unsubscribe` messages. A subscribe is answered with `SNAPSHOT` before later patches.
- [x] Filters evaluated by `packages/query-engine`:
  - [x] 4.2a Build `query-engine`: parse `'latency > 200'`-style filters into an AST (`field`, `op`, `value`), `evaluate(diffContext)` per diff. Operators: `>`, `<`, `>=`, `<=`, `=`, `!=` + `OR` via comma.
- [x] Fan-out on `livescope.fanout`. `REDIS_URL` uses Redis Pub/Sub; tests use `MemoryStateBus`.

### 4.3 `apps/dashboard` (React + Vite + Zustand)
- [x] Service grid: one card per service — status, latency, error rate, RPS — all updating from PATCH diffs.
- [x] Reconnect backoff (`reconnectDelay`, capped at 15s). A subscribe is SNAPSHOT, then PATCHes. The client store has no `setInterval` and no `fetch(`.
- [x] Alert list for `ALERT` events.
- [x] Time-travel slider on each card. `historicalPath` builds `/state?entityId=&at=`; `pullState` loads it through an injected fetcher so the view does not poll.
- [x] System health section: connection status of internal services, plus a per-card divergence count.

**Acceptance gate:** run seed script → cards animate live; kill seed → values freeze; restart → they resume. No polling anywhere in the dashboard code (grep for `setInterval` doing fetch — should find nothing).

---

## Phase 5 — Intelligence + Resilience (2–3 days)

**Goal: the system detects problems and survives them — the memorable demos.**

### 5.1 `apps/anomaly-detector`
- [x] Consume metric events; per (entity, metric) maintain EWMA with dynamic threshold (`|value - ewma| > 3 * stddev`). `POST /sample` is the process entry.
- [x] On breach: `alertFromSignal` emits `ALERT_RAISED`. The projection bus marks alert events HIGH.
- [x] Alert auto-resolves when value returns within bounds for N consecutive events (`ALERT_RESOLVED`).

### 5.2 `apps/chaos-engine`
- [x] HTTP API to inject faults (`POST /faults`, `GET /faults`):
  - `dropPercent` — gateway randomly drops % of events,
  - `delayMs` — artificial latency before Kafka produce,
  - `killNode` — mark a projection-engine instance killed,
  - `redisDown` — block Redis writes.
- [x] Every fault auto-expires after a TTL; injections are appended to the chaos log.

### 5.3 `apps/region-simulator`
- [x] Tag events with `region`; `POST /deliver` drops cross-region events while a partition is on.
- [x] `POST /divergence` counts CONCURRENT vector clocks. The dashboard card shows that count.

**Acceptance gate:** chaos → alert, crash recovery, and region convergence from [docs/17-demo-scenarios.md](docs/17-demo-scenarios.md) are reproducible on demand.

---

## Phase 6 — Production Hardening (ongoing)

**Goal: from "works on my machine" to "deployable and provable".**

- [x] 6.1 **CI (GitHub Actions):** lint, build, test, and the load-test gate run on push and pull request. `TURBO_TOKEN` / `TURBO_TEAM` turn on remote cache when those secrets exist. Marking the workflow as a required check is a GitHub branch-protection setting and needs a repo admin.
- [x] 6.2 One multi-stage `infra/Dockerfile` (node:22-alpine, non-root user) parameterized by package, plus `infra/docker-compose.prod.yml` for Kafka, Schema Registry, Redis, Postgres, and every app. `docker compose -f infra/docker-compose.prod.yml up` is the single command.
- [x] 6.3 **Performance regression gate:** `scripts/load-test.js` runs in CI and fails if throughput drops more than 10% below `scripts/baseline.json`.
- [x] 6.4 Each service calls `dogfoodClient` on startup. It emits through the SDK only when `LIVESCOPE_GATEWAY_URL` is set.
- [x] 6.5 Helm chart renders a Deployment and Service per app (`infra/helm/livescope`). `infra/argocd/application.yaml` points Argo CD at that chart. A kind cluster is not created from this repo automatically.
- [ ] 6.6 (Later) Streaming ML layer: changepoint detection, log template mining, failure prediction. The roadmap keeps this after the reliability loop, and it is still future work.

---

## Rules of Engagement

1. **Vertical slices over horizontal layers.** Never build "all of X, then all of Y". Each phase is a working slice.
2. **No acceptance gate, no merge.** The gates above are the definition of done.
3. **Every package gets property tests before its first consumer.** Correctness libs (clocks, CRDTs, diffs) are math — prove them.
4. **Realistic infra only in compose.** No mocks for Kafka/Redis/Mongo in `pnpm dev` — the demo *is* the integration test.
5. **Update this file as you go.** Check boxes, and if reality diverges from plan, the plan changes — not the acceptance gates.

---

## Time Estimate

| Phase | Days (solo, focused) |
|---|---|
| 0 — Foundation | 0.5 |
| 1 — Core packages | 2–3 |
| 2 — Ingestion | 2–3 |
| 3 — State | 3–4 |
| 4 — Delivery + Dashboard | 3–4 |
| 5 — Intelligence + Resilience | 2–3 |
| 6 — Hardening | ongoing |

**~2–3 weeks of focused work to "usable demo".**