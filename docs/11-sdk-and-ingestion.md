# 11 — SDK & Ingestion

> Status: SDK `[PLANNED]` (package scaffolded, no code). Ingestion `[IN PROGRESS]` — Kafka + Avro + Schema Registry pipeline works for `METRIC_RECORDED` via a one-shot gateway script; a real gateway server is planned. OTLP ingestion `[PROPOSED]`.

## Developer experience target

```ts
import { LiveScope } from '@livescope/sdk';

const livescope = new LiveScope({
  apiKey: process.env.LIVESCOPE_API_KEY,   // org/project-scoped ingest key
  serviceName: 'checkout-api',
  environment: 'production',              // default: env var
});

// Metrics
livescope.metric('checkout.latency', 183, { route: '/checkout' });

// Logs
livescope.log('error', 'Payment failed', { orderId });

// Traces
const span = livescope.trace('checkout');
// ... do work ...
span.tag('status', 200).end();
```

Optional middleware/interceptors (Pino transport, Express middleware, OTel bridge) are P1.

## SDK API

| API | Semantics |
|---|---|
| `metric(name, value, tags?)` | Point-in-time numeric. Validated client-side (finite number, name charset), buffered. |
| `log(level, message, context?)` | Structured log event. Context is JSON-safe, size-capped. |
| `trace(name)` → `Span` | Span with `.tag(k,v)`, `.end()`. Parent-child via async-context tracking where the platform supports it. |
| `flush()` | Force-send buffer. Returns ack resolution. |
| `close()` | Flush + disconnect, for graceful shutdown. |

Additional metadata methods (P1): `setDeployment({version, commit})`, `annotateIncident(msg)` — deployment identity is normally injected via env/CI, not hand-written.

## Batching & transport

- Buffer flushes on **500ms interval or 100 events**, whichever first (defaults, configurable).
- Transport: **gRPC** to the gateway (decision rationale in [19-architecture-decisions.md](19-architecture-decisions.md)); batch RPC `BatchEvents`.
- **Retries:** exponential backoff (100ms base, 8x cap), max 3 attempts per batch. On final failure: drop policy per signal type — metrics/logs are sampled-to-DLQ-client-side and dropped (telemetry, not transactions), with client-side counters exposed at `/.well-known/livescope/stats` for the host app to scrape if it cares. The SDK must **never block or throw into the host application** because LiveScope is down — observability must not take down the observed system.
- **Ordering:** events carry the SDK's per-node vector clock ticks (the existing `vector-clock` package design, [BUILD-PLAN.md](../BUILD-PLAN.md)); the gateway keys Kafka messages by `entityId` for per-entity partition ordering.
- **Idempotency:** client-generated UUIDv4 event ids make retry-safe deduplication possible end-to-end (DLQ and projection drop causally-old duplicates).

## Sampling

- Default: full sampling in dev; production policy-based (per signal type, per metric name).
- Metrics: optional client-side aggregation for high-frequency counters (P1) — e.g. flush a histogram summary instead of 10k points.
- Traces: head-based sampling default 100% in dev, 10% prod + **always-keep error traces** (tail flag at gateway).

## Authentication & identity

- **API key** (`LIVESCOPE_API_KEY`): org/project-scoped ingest credential; sent per gRPC connection (mTLS/token per [14-security.md](14-security.md)); rotated via dashboard; client caches, handles 401 with a single re-auth.
- **Service identity:** `serviceName` + `environment` + deployment identity (version/commit via env vars `LIVESCOPE_DEPLOY_VERSION`, `LIVESCOPE_DEPLOY_COMMIT` injected by CI/CD). Deployment identity is what enables deploy-correlation evidence in investigations — v1 must capture it.

## Failure behavior

| Failure | SDK behavior |
|---|---|
| Network down | Buffer up to N (default 5k events / 5MB); then oldest-first drop with counter. Never blocks host app. |
| Gateway 401/403 | Surface one-time error callback + metric; stop retry storm (exponential). |
| Schema mismatch (client/server version drift) | Gateway rejects to DLQ; SDK exposes client version in metadata for debugging. |
| Host process crash | In-flight buffer lost (acceptable for telemetry); graceful shutdown hooks (`close()`) minimize loss. |

## Performance overhead budget

- Emit: < 50µs per event (buffer append), zero network on hot path.
- Memory: bounded buffer (default 5MB cap).
- CPU: < 1% typical steady state; background flush thread/task.
- No synchronous network calls on any public API path — enforced by design.

## Privacy & security

- The SDK never reads secrets, env-dump, or auto-collects sensitive payloads; tags/context are caller-provided only.
- Server-side redaction hooks (`redact: ['authorization', '*.token']` config) apply before buffering.
- Telemetry is **untrusted input** end-to-end: the gateway validates against Avro schemas, caps sizes, and the AI plane treats all content as data-not-instructions ([08-safety-and-autonomy.md](08-safety-and-autonomy.md) § Prompt injection).

## Ingestion gateway (server side)

Planned evolution of the existing `apps/gateway`:

1. `[IMPLEMENTED]` One-shot producer: Avro encode + Kafka produce for `METRIC_RECORDED` (works; is not a server).
2. `[PLANNED]` gRPC server: `BatchEvents` RPC, auth, schema validation, entityId-keyed production, DLQ for rejects, idempotent producer, circuit breaker around Kafka.
3. `[PROPOSED]` OTLP endpoints (gRPC + HTTP) alongside the native protocol, normalizing OTel data into the same event schemas (FR-004).

Gateway rules:

- Validate everything (schema, size caps, rate limits per key) **before** Kafka.
- Rejects go to `events.dlq` with rejection reason — never silently dropped.
- The gateway never transforms content semantically; normalization for OTel is lossless-by-mapping, documented per field.

## Related documents

API contracts: [12-api-contracts.md](12-api-contracts.md) · Schemas: [10-data-model.md](10-data-model.md) § Event · Reliability of the pipeline: [15-reliability.md](15-reliability.md) · gRPC/gateway decisions: [19-architecture-decisions.md](19-architecture-decisions.md)