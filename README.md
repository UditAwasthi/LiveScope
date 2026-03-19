<div align="center">

# ⚡ LiveScope

### Distributed Developer Observability Platform

**Event-Sourced · CQRS · Push-Based Streaming · Real-Time Diffs**

[![Node.js](https://img.shields.io/badge/Node.js-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Kafka](https://img.shields.io/badge/Apache-Kafka-231F20?style=flat-square&logo=apachekafka)](https://kafka.apache.org/)
[![Redis](https://img.shields.io/badge/Redis-Pub%2FSub%20%2B%20CRDTs-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![React](https://img.shields.io/badge/React-Zustand-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

> **A system where application state is continuously streamed to clients through event-driven diffs — instead of being requested.**

</div>

---

## What Is LiveScope?

LiveScope eliminates polling. Services instrument themselves with a lightweight SDK that emits structured events. Those events flow through an Apache Kafka pipeline, are processed by a CQRS projection engine with **vector clock ordering**, and are pushed as **real-time state diffs** to a browser dashboard via WebSockets.

No refresh buttons. No fetch intervals. The dashboard is a live mirror of your system.

**This is not a MERN app. This is distributed infrastructure.**

---

## Architecture

```
Write Plane:
  SDK Agent → gRPC Gateway → Kafka (schema registry · dead letter queue)

Read Plane:
  Kafka → Projection Engine (vector clocks · CQRS) → Redis (CRDTs · Pub/Sub)
        → Anomaly Detector (EWMA)
        → Stream Engine (diff · LZ4 · priority lanes · backpressure)
        → WebSocket Gateway (auth · subscriptions)
        → React Dashboard (Zustand · zero polling)
```

### Data flow in one sentence

`emit event → store in Kafka → project to state → diff → push to subscriber`

---

## Key Technical Decisions

| Problem | Solution | Where |
|---|---|---|
| Ordering events across distributed nodes | Vector clocks (causal ordering, not wall-clock) | `packages/vector-clock` |
| Concurrent counter updates without locks | CRDTs — GCounter, PNCounter | `packages/crdt` |
| State recovery after crash | Snapshot + event replay from MongoDB | `apps/projection-engine/snapshot` |
| High-frequency metric diff delivery | LZ4 real-time compression + dual priority lanes | `apps/stream-engine` |
| Slow clients blocking fast ones | Adaptive backpressure with coalescing | `apps/stream-engine/backpressure` |
| Schema evolution without breakage | Avro + Confluent Schema Registry (backward-compat) | `packages/event-schemas` |
| Proving resilience | Chaos engine: drop events, kill nodes, delay Kafka | `apps/chaos-engine` |
| Debugging past incidents | Time-travel replay — scrub dashboard to any timestamp | `apps/projection-engine/replay` |

---

## Monorepo Structure

```
livescope/
├── apps/
│   ├── gateway/              # gRPC ingestion · circuit breaker · rate limiter
│   ├── projection-engine/    # CQRS processor · vector clocks · snapshot+replay
│   ├── stream-engine/        # diff gen · LZ4 · priority lanes · adaptive batching
│   ├── websocket-gateway/    # JWT auth · topic subscriptions · Redis Pub/Sub sync
│   ├── anomaly-detector/     # EWMA-based spike detection · alert event emitter
│   ├── chaos-engine/         # fault injection: drop%, delay, node kill, Redis fail
│   ├── region-simulator/     # multi-region latency simulation · failover routing
│   └── dashboard/            # React · Zustand · WebSocket client · no polling
│
├── packages/
│   ├── sdk/                  # client SDK — npm publishable
│   ├── event-schemas/        # Avro schemas + generated TypeScript types
│   ├── vector-clock/         # VectorClock, merge(), compare(), tick()
│   ├── crdt/                 # GCounter, PNCounter, LWWRegister
│   ├── diff-engine/          # diff(prev, next), applyPatch(state, diff)
│   ├── query-engine/         # subscription query parser + AST evaluator
│   └── utils/                # logger, retry, circuitBreaker, healthCheck
│
├── infra/
│   ├── docker-compose.yml    # full local stack (one command)
│   ├── kafka/                # broker config, topic definitions
│   ├── redis/                # cluster setup
│   ├── mongodb/              # init scripts, index definitions
│   └── timescaledb/          # schema migrations, retention policies
│
└── scripts/
    ├── seed-events.js         # populate realistic test data
    └── load-test.js           # throughput benchmarking
```

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- pnpm 8+

### Start the full stack

```bash
git clone https://github.com/yourusername/livescope.git
cd livescope

# Start all infrastructure (Kafka, Redis, MongoDB, TimescaleDB)
docker compose -f infra/docker-compose.yml up -d

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start all services in development mode
pnpm dev
```

Dashboard opens at **http://localhost:3000**

### Emit your first events

```typescript
import { LiveScopeClient } from '@livescope/sdk';

const client = new LiveScopeClient({
  endpoint: 'localhost:50051',
  serviceName: 'my-api',
  environment: 'dev',
});

// Emit a metric
client.metric('request.latency', 120, { route: '/users' });

// Emit a log
client.log('info', 'Request handled', { userId: 'u_123', duration: 120 });

// Emit a trace span
const span = client.trace('handleRequest');
// ... do work ...
span.tag('status', 200).end();

// Flush immediately (default: auto-flush every 500ms)
await client.flush();
```

### Seed with realistic load

```bash
# Emit 10,000 events from 5 simulated services
node scripts/seed-events.js --services 5 --events 10000

# Run throughput benchmark
node scripts/load-test.js --rps 5000 --duration 60
```

---

## Event Schema

Every event entering the system must conform to this structure:

```typescript
interface LiveScopeEvent {
  id:          string;        // UUIDv4 — idempotency key
  type:        string;        // METRIC_RECORDED | LOG_EMITTED | SPAN_ENDED | etc.
  entity:      string;        // entity type: "service" | "trace" | "alert"
  entityId:    string;        // e.g. "api-gateway", "trace_abc123"
  payload:     object;        // type-specific fields
  timestamp:   number;        // unix ms
  vectorClock: VectorClock;   // { [nodeId: string]: number }
}
```

Diff payloads sent to WebSocket subscribers:

```typescript
interface DiffEvent {
  type:    'PATCH' | 'SNAPSHOT' | 'DELETE' | 'ALERT';
  entity:  string;
  id:      string;
  changes: Partial<Record<string, unknown>>;  // only what changed
}
```

---

## Demo Scenarios

Run these in order to show the full capability of the system.

**Demo 1 — Live streaming**
Start 3 service simulators via `seed-events.js`. Watch the dashboard cards update in real time with no refresh.

**Demo 2 — Chaos injection**
Open the Chaos Engine tab. Enable 30% event drop on `api-gateway`. Watch the anomaly detector fire a CRITICAL alert on the dashboard within seconds.

**Demo 3 — Self-healing**
Disable the chaos fault. Watch the system reconverge to correct state automatically. Alert resolves when EWMA returns to within bounds.

**Demo 4 — Time-travel debugging**
Click the clock icon on any service card. Drag the timeline slider backwards. The dashboard reconstructs and displays the system state at that exact timestamp from the event log.

**Demo 5 — Crash recovery**
Kill the projection engine process. Restart it. Watch the System Health page — state is fully recovered from snapshot + replay within 5 seconds.

**Demo 6 — Region failover**
Open Region Simulator. Partition `eu-west`. Watch traffic reroute to `us-east` and the dashboard show the divergence and reconciliation.

---

## Queryable Subscriptions

Clients can subscribe with filters instead of receiving every diff:

```typescript
// Only receive diffs for services where latency > 200ms or error rate > 5%
socket.emit('subscribe', {
  entity:  'service',
  filters: ['latency > 200', 'errorRate > 5'],
  fields:  ['latency', 'errors', 'status'],
});
```

The stream engine evaluates each diff against active query ASTs server-side. Only matching, field-projected diffs are delivered.

---

## Persistence Strategy

| Store | Role | Why |
|---|---|---|
| **MongoDB** | Append-only event store | Document model; natural append; cursor-based replay |
| **Redis** | Hot state cache + Pub/Sub | Sub-ms reads; native pub/sub; CRDT-safe counters |
| **TimescaleDB** | Metric time-series | SQL + time-bucket aggregations; automatic retention |
| **Kafka** | In-flight event log | Durable; consumer group parallelism; partition ordering |

---

## Performance Targets

| Metric | Target |
|---|---|
| SDK emit → Kafka ack | P99 < 5ms |
| Kafka offset → Redis write | P99 < 50ms |
| State update → WebSocket client | P99 < 100ms |
| Alert delivery (HIGH lane) | P99 < 10ms |
| Kafka throughput | 50k events/sec sustained |
| Concurrent WebSocket connections | 5,000 per stream-engine instance |
| Crash recovery time | < 5 seconds |
| LZ4 payload reduction | 50–70% on metric diff batches |

---

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (all services and packages) |
| Event transport | Apache Kafka 3.x |
| Schema registry | Confluent Schema Registry (Avro) |
| Ingestion | gRPC (protobuf) |
| Hot cache | Redis 7 (Pub/Sub + CRDT counters) |
| Event store | MongoDB 7 (append-only) |
| Time-series | TimescaleDB (PostgreSQL extension) |
| Streaming | Socket.IO 4 over WebSocket |
| Frontend | React 18 + Zustand |
| Monorepo | Turborepo |
| Local infra | Docker Compose |

---

## Build Phases

| Phase | Scope | Milestone |
|---|---|---|
| 1 — Core Pipeline | SDK · gRPC gateway · Kafka · projection engine | Events flow end-to-end, logged to console |
| 2 — State Storage | MongoDB · Redis · TimescaleDB · snapshot+replay | State survives restarts, replay works |
| 3 — WebSocket Streaming | Stream engine · WebSocket gateway · React dashboard | Live dashboard with zero polling |
| 4 — Resilience + Advanced | Circuit breaker · vector clocks · CRDT · chaos engine · time-travel | Production-grade behaviour, full demo suite |

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Built to demonstrate production-grade distributed systems design.

**Event Sourcing · CQRS · Vector Clocks · CRDTs · Kafka · WebSockets**

</div>
