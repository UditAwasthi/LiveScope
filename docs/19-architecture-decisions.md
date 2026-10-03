# 19 — Architecture Decisions

> Format per decision: Problem · Options · Decision · Why · Tradeoffs · When to reconsider. We do **not** keep a technology because it looks impressive; every keep/kill is argued here. Status tags: `[KEPT — IMPLEMENTED]`, `[KEPT — PLANNED]`, `[PROPOSED]`, `[REJECTED]`, `[DEFERRED]`.

---

## AD-01 — Event transport: Apache Kafka

- **Problem:** durable, ordered, replayable event backbone between ingestion and processing.
- **Options:** Kafka · RabbitMQ · Redpanda · NATS JetStream · Kinesis.
- **Decision:** `[KEPT — IMPLEMENTED]` Kafka (Confluent images, 3.x) via kafkajs.
- **Why:** replay semantics (consumer offsets) are load-bearing for the System Twin historical layer, snapshot+replay recovery, and Fix Lab incident replay; partition-per-entity ordering; huge operational knowledge base.
- **Tradeoffs:** operational weight (ZooKeeper today — KRaft can remove it); kafkajs maturity vs franz-go; requires schema registry discipline.
- **Reconsider:** if single-binary deploys matter more than replay semantics → Redpanda (API-compatible, lower ops). Not before Phase 2 completes.

## AD-02 — Schema governance: Avro + Confluent Schema Registry

- **Problem:** producers and consumers must evolve independently without silent breakage; events are the product's contract.
- **Options:** Avro+Registry · Protobuf · JSON Schema · none (trust TS types).
- **Decision:** `[KEPT — IMPLEMENTED]` Avro + Schema Registry, BACKWARD compatibility, one subject per event type.
- **Why:** already working end-to-end for `METRIC_RECORDED`; compact binary suits high-volume telemetry; registry IDs give cheap wire evolution.
- **Tradeoffs:** dual maintenance of `.avsc` + TS types (mitigate: codegen later — tracked as unresolved question); Avro's record model less ergonomic for traces.
- **Reconsider:** if codegen friction stays high, Protobuf gives native TS codegen; only at a breaking-event-contract moment, never mid-phase.

## AD-03 — Hot state cache + fanout: Redis

- **Problem:** sub-ms current-state reads and pub/sub fanout to stream engine.
- **Options:** Redis (cache + pub/sub) · in-process state in the projection engine · direct DB reads.
- **Decision:** `[KEPT — PLANNED]` Redis as cache + pub/sub. **Never the source of truth** ([15-reliability.md](15-reliability.md)).
- **Why:** hot entity state is small and read-hot; pub/sub decouples projection from streaming; rebuildable-by-replay keeps the architecture honest.
- **Tradeoffs:** one more stateful dependency; Redis Streams vs Pub/Sub for delivery guarantees (choose Pub/Sub + Kafka as the durable fallback).
- **Reconsider:** if Redis becomes consistency-relevant in practice (i.e., someone treats it as a database), that's a design bug to fix, not a Redis change.

## AD-04 — Event store: MongoDB (original plan) → PostgreSQL/TimescaleDB

- **Problem:** durable append-only event store powering replay and reconstruction.
- **Options:** MongoDB (original README plan) · PostgreSQL (partitioned table) · Kafka-only retention · EventStoreDB.
- **Decision:** `[PROPOSED — CHANGED]` consolidate on **PostgreSQL/TimescaleDB** for the event store, instead of adding MongoDB. The original repo planned MongoDB; this doc revisits it honestly.
- **Why:** Phase 3+ already requires Postgres for control-plane and Twin graph data; running Mongo *as well* adds a whole database (backup, HA, security surface, operational skill) for a single append-heavy use case Postgres partitioning handles fine at LiveScope's scale (≤50k events/sec sustained target is well within partitioned-Postgres territory). Fewer stores = fewer failure modes, one backup story, one security model.
- **Tradeoffs:** Mongo's document model fits variable event payloads naturally — mitigated by JSONB payload column + Avro schema on the wire; if we ever exceed Postgres write throughput, revisit.
- **Reconsider:** telemetry volume > ~50k events/s sustained *retained in the store*, or JSONB indexing costs prove material. Revisit = benchmark, not vibes.

## AD-05 — Time-series storage: TimescaleDB

- **Problem:** metric storage with time-bucket aggregation and retention.
- **Options:** TimescaleDB · raw Postgres tables · ClickHouse · InfluxDB · VictoriaMetrics.
- **Decision:** `[PROPOSED]` TimescaleDB (piggy-backs AD-04's Postgres).
- **Why:** continuous aggregates + retention policies fit the query patterns exactly ([10-data-model.md](10-data-model.md)); one engine for control plane + telemetry simplifies local dev and ops.
- **Tradeoffs:** not ClickHouse-class at extreme scale; fine for target volumes (50k ev/s, 30d raw retention).
- **Reconsider:** multi-tenant hosted scale-out; then ClickHouse for metrics only.

## AD-06 — CRDTs (GCounter, PNCounter, LWWRegister)

- **Problem:** concurrent counter/state updates from distributed ingestion nodes without locks or coordination.
- **Options:** CRDTs · last-writer-wins with wall clock · single-writer sharding.
- **Decision:** `[KEPT — PLANNED]` CRDT counters/registers for hot per-entity state where concurrent writers exist (error counts, event counters, status).
- **Why:** merge-any-order convergence is provable (property-tested), aligns with at-least-once delivery, and gives deterministic multi-region convergence later.
- **Tradeoffs:** CRDT discipline is easy to misuse (only applies where commutativity is semantically right — e.g. don't CRDT a "current version" field that isn't last-write-wins by nature); costs some per-merge bookkeeping.
- **Reconsider:** if ingestion is ever single-partitioned per entity with one writer, plain counters suffice — keep the package, use it where it earns its complexity.

## AD-07 — Vector clocks

- **Problem:** causal ordering of events across nodes; detecting duplicates/concurrency without wall clocks.
- **Options:** vector clocks · Lamport clocks · Hybrid Logical Clocks (HLC) · wall clock only.
- **Decision:** `[KEPT — PLANNED, with a caveat]` vector clocks as designed, scoped to per-entity event streams (each event carries a small per-entity clock). Caveat honestly stated: full vector clocks scale poorly with many writers per entity; our scope (per-entity, few writer nodes) keeps them small.
- **Why:** already the design in event schemas `[IMPLEMENTED]` (field exists, semantics partially); concurrency detection is genuinely needed to drop causally-old duplicates.
- **Tradeoffs:** size growth with writers per entity; merge complexity; if a future design needs global ordering, vector clocks don't provide it.
- **Reconsider:** if per-entity writer counts grow (e.g. thousands of SDK instances per entity) → switch to HLC (lighter, near-causal). This is the most likely mid-course correction in the set.

## AD-08 — Ingestion protocol: gRPC (+ OTLP)

- **Problem:** efficient, typed, streaming-capable ingestion from SDKs.
- **Options:** gRPC · HTTP/JSON · OTLP-only.
- **Decision:** `[KEPT — PLANNED]` gRPC for the native SDK path; **add OTLP ingestion** as a peer protocol `[PROPOSED]` (FR-004).
- **Why:** streaming + typed contracts; protobuf tooling for the gateway server; OTLP is mandatory for adoption (users will not re-instrument existing OTel apps).
- **Tradeoffs:** browser/unusual clients can't speak gRPC directly → gateway also needs an HTTP ingest route `[FUTURE]`; running two protocols is surface area.
- **Reconsider:** if OTLP covers >90% of real usage, native protocol becomes legacy — fine outcome.

## AD-09 — Realtime delivery: WebSockets (Socket.IO)

- **Problem:** push diffs and incident events to the dashboard with reconnect/replay semantics.
- **Options:** Socket.IO · raw WS · SSE · polling (rejected on principle).
- **Decision:** `[KEPT — PLANNED]` Socket.IO 4 (original design), diff-based payloads ([BUILD-PLAN.md](../BUILD-PLAN.md) Phase 4).
- **Why:** reconnection/room semantics out of the box; diff + snapshot protocol keeps payloads tiny; zero polling is a product identity ([13-dashboard-ux.md](13-dashboard-ux.md)).
- **Tradeoffs:** Socket.IO protocol lock-in; long-term could matter for non-JS clients → resumable-sequence design in [12-api-contracts.md](12-api-contracts.md) keeps an escape hatch.
- **Reconsider:** mobile/embedded client pressure → raw WS + explicit resume protocol.

## AD-10 — LLM providers

- **Problem:** the AI plane needs reasoning with provider independence, cost control, and eval comparability.
- **Options:** single provider SDK · provider-abstraction layer · local models.
- **Decision:** `[PROPOSED]` thin provider-abstraction layer from day one (chat + tool-calling interface), provider+model as config; every benchmark eval run records provider/model ([16-ai-evaluation.md](16-ai-evaluation.md)).
- **Why:** model quality changes quarterly; eval suite makes switching evidence-based; avoids pricing lock-in.
- **Tradeoffs:** abstraction can lag provider-specific features (mitigate: capability flags, not lowest-common-denominator-only).
- **Reconsider:** whenever eval shows a dominant provider gap — that's the process working, not a redesign.

## AD-11 — Embeddings / incident-memory search

- **Problem:** incident memory similarity search (FR-011/021) and evidence retrieval.
- **Options:** pgvector · dedicated vector DB (Pinecone/Qdrant/Weaviate) · BM25-only.
- **Decision:** `[PROPOSED]` pgvector inside the Postgres consolidation (AD-04), BM25 alongside.
- **Why:** incident volume (10²–10⁴/yr) is tiny for vector search; no new infrastructure; hybrid search beats pure-vector for structured queries.
- **Tradeoffs:** not billion-scale ANN; irrelevant at our volumes.
- **Reconsider:** hosted multi-tenant scale-out.

## AD-12 — Agent orchestration

- **Problem:** how the AI plane runs: swarm vs single orchestrator vs workflow engine.
- **Options:** multi-agent framework (N agents, agent-to-agent chat) · single orchestrator + tool registry · rigid pipelines (LangGraph-style graphs) · no LLM (pure rules).
- **Decision:** `[PROPOSED]` **single orchestrator + permissioned tool registry + deterministic executor** ([06-ai-architecture.md](06-ai-architecture.md)). No agent-to-agent chat, no swarm. Detection/correlation stay non-LLM.
- **Why:** auditability (one reasoning loop to trace), safety (capability-bounded by registry, not by prompt-to-prompt politeness), cost, and the state machine in [09-incident-engine.md](09-incident-engine.md) already provides the "workflow" structure a graph framework would.
- **Tradeoffs:** single context window must be managed (evidence packets are pre-shaped to fit); less research-y.
- **Reconsider:** if investigation needs long-running parallel evidence gathering that starves a single context → promote *specific* capabilities per the promotion criteria in [06-ai-architecture.md](06-ai-architecture.md), not a general swarm.

## AD-13 — Container/orchestration: Docker Compose now, Kubernetes later

- **Problem:** local dev stack + eventual production/sandbox hosting.
- **Options:** Compose-only · k3s from day one · full K8s.
- **Decision:** `[KEPT — IMPLEMENTED]` Docker Compose for dev; Kubernetes (kind/k3s) enters at Phase 5–6 `[PROPOSED]` because Fix Lab sandboxes and mutating tools (deploy/scale) need it.
- **Why:** K8s earlier adds friction with zero product value in Phases 0–4; Fix Lab sandbox orchestration is the first *real* K8s need.
- **Tradeoffs:** sandbox design must then be K8s-shaped; Compose-based dev and K8s-based prod can drift (mitigate: Helm/Kustomize from Phase 5).
- **Reconsider:** never — the question is only *when* K8s lands, and the answer is tied to Phase 5/6 scope.

## AD-14 — Frontend: React 18 + Zustand + Vite

- **Problem:** dashboard implementation.
- **Decision:** `[KEPT — PLANNED]` React 18 + Zustand (state) + Vite (build). Matches original scaffold and the diff-push client model.
- **Why:** Zustand's store model maps cleanly onto PATCH-diff application; Vite dev ergonomics.
- **Tradeoffs:** no Next.js/SSR needs here (dashboard is auth-gated client app); fine.
- **Reconsider:** only if product pivots to marketing-facing public pages (out of scope, [20-non-goals.md](20-non-goals.md)).

## AD-15 — Monorepo & build: Turborepo + pnpm + TypeScript strict

- **Decision:** `[KEPT — IMPLEMENTED]`. Working; strict TS + vitest added in Phase 0 ([BUILD-PLAN.md](../BUILD-PLAN.md)).
- **Why / tradeoffs / reconsider:** proven adequate; reconsider only at contributor-scale pain.

---

## Consolidation summary (the honest deltas vs the original README)

| Original plan | This doc's position |
|---|---|
| MongoDB event store | `[PROPOSED CHANGE]` → Postgres/TimescaleDB event store (AD-04) |
| Mongo + Redis + Timescale + Kafka (4 stores) | → Kafka + Postgres/Timescale + Redis (3 stores; AD-04/05/11) |
| Vector clocks, unqualified | → scoped per-entity, HLC as named fallback (AD-07) |
| CRDTs as headline feature | → kept where semantics fit, not a marketing-tier concern (AD-06) |
| gRPC ingestion only | → + OTLP as peer protocol (AD-08) |
| "AI/anomaly" as EWMA detector only | → anomaly detection stays deterministic; LLM plane is separate and capability-bounded (AD-12) |

## Unresolved questions (tracked, not hidden)

1. Avro→TS codegen vs hand-mirrored types (current duplication is acceptable until the 4th event schema).
2. Redis Streams vs Pub/Sub for stream-engine sourcing (decide in Phase 1 with load tests).
3. Sandbox substrate details (namespace-per-experiment vs shared sandbox pool) — Phase 5 design spike.
4. Notification channels (Slack/webhooks) scope — before Phase 6 approval UX, since approvals may need out-of-band escalation.
5. Multi-tenancy hosting model (single-cluster vs cell-based) — before any hosted offering; not on the local roadmap's critical path.

## Related documents

[03-system-overview.md](03-system-overview.md) · [10-data-model.md](10-data-model.md) · [15-reliability.md](15-reliability.md) · [18-roadmap.md](18-roadmap.md)