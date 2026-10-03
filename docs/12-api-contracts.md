# 12 — API Contracts

> Status: `[PROPOSED]` — conceptual contracts, not implemented. These define the surface future coding agents build against. Transport: HTTPS REST (JSON) for control plane + query; gRPC for ingestion (see [11-sdk-and-ingestion.md](11-sdk-and-ingestion.md)); WebSocket for realtime. Consistent conventions below apply everywhere.

## Conventions

- Auth: `Authorization: Bearer <token>` (users, short-lived) or `X-LiveScope-Api-Key` (services/integrations, scoped).
- All responses: `{ data: ..., error?: { code, message, details } }`.
- Pagination: cursor-based (`?cursor=`, response `{ data, nextCursor }`).
- Scoping: every path is org/project-scoped; org id derives from the credential, never from the caller's input (tenant isolation by construction, [14-security.md](14-security.md)).
- IDs: prefixed (`svc_`, `inc_`, `exp_`, `plan_`, `exe_`, `org_`, `prj_`, `env_`, `dep_`).
- Time: RFC3339 or epoch ms; ranges are `?from=&to=`.

---

## Authentication

```text
POST /v1/auth/token          { apiKey } → { token, expiresAt }   (exchange for service tokens)
POST /v1/auth/refresh        { refreshToken } → { ... }
```

User auth via SSO/OIDC `[PROPOSED]`; API keys managed under organizations (below).

## Organizations, projects, environments, API keys

```text
GET/POST        /v1/orgs                                  list/create (admin)
GET/PATCH       /v1/orgs/:orgId                           get/update settings, autonomy level
GET/POST        /v1/orgs/:orgId/projects
GET/PATCH       /v1/orgs/:orgId/projects/:prjId
GET/POST        /v1/orgs/:orgId/projects/:prjId/environments
POST/DELETE     /v1/orgs/:orgId/api-keys                  create returns plaintext once; delete revokes
GET             /v1/orgs/:orgId/audit                     audit log (cursor-paginated, filterable)
```

## Services, deployments

```text
GET   /v1/orgs/:orgId/projects/:prjId/services                  catalog w/ health
GET   /v1/.../services/:svcId                                   detail (current Twin state summary)
GET   /v1/.../services/:svcId/health                            live health signals
GET   /v1/.../services/:svcId/deployments?from=&to=             history w/ diffs
GET   /v1/.../services/:svcId/configuration                     redacted config, versioned
GET   /v1/orgs/:orgId/topology?service=?&depth=                 Twin graph (nodes+edges w/ confidence)
```

## Telemetry queries

```text
GET   /v1/.../services/:svcId/metrics?names=&from=&to=&agg=&interval=   → time-bucketed series
POST  /v1/.../metrics/query    { seriesFilter, range, agg } → series[]    (ad-hoc query)
GET   /v1/.../services/:svcId/logs?from=&to=&level=&q=&cursor=           → log entries
GET   /v1/.../traces/:traceId                                           → spans (waterfall data)
GET   /v1/.../services/:svcId/traces?slow=true&from=&to=                → slow/err trace list
```

## Alerts & incidents

```text
GET   /v1/orgs/:orgId/alerts?state=&service=&from=                     alert list
POST  /v1/orgs/:orgId/incidents/:incId/annotations                     human timeline note
GET   /v1/orgs/:orgId/incidents?state=&severity=&service=              incident list
GET   /v1/orgs/:orgId/incidents/:incId                                 full record (timeline, evidence, hypotheses)
GET   /v1/orgs/:orgId/incidents/:incId/timeline                        append-only timeline
POST  /v1/orgs/:orgId/incidents/:incId/investigate                     trigger/re-run AI investigation
GET   /v1/orgs/:orgId/incidents/:incId/diagnosis                       hypotheses + evidence-cited report
POST  /v1/orgs/:orgId/incidents/:incId/ack      { by }                 acknowledge (IC takes ownership)
POST  /v1/orgs/:orgId/incidents/:incId/resolve                          manual resolve (human path)
```

## System Twin

```text
GET   /v1/orgs/:orgId/twin/entities?kind=                    entity list w/ freshness
GET   /v1/orgs/:orgId/twin/entities/:entId?at=<ts>           state now or at time T (reconstructed)
GET   /v1/orgs/:orgId/twin/relationships?from=|to=           edges w/ confidence/staleness
GET   /v1/orgs/:orgId/twin/coverage                         trust/freshness metrics
```

`?at=` reconstruction responses include the reconstruction report (snapshot id, events applied, gaps) — see [04-system-twin.md](04-system-twin.md).

## Fix Lab

```text
POST  /v1/orgs/:orgId/incidents/:incId/experiments           create FixExperiment
      { hypothesisId, proposedChange, environment, workload, budget, expectedOutcome }
      → 201 { id, state: PENDING }
GET   /v1/orgs/:orgId/experiments/:expId                     experiment record + results
GET   /v1/.../incidents/:incId/experiments                   all experiments for incident
POST  /v1/orgs/:orgId/experiments/:expId/abort               abort + teardown receipt
GET   /v1/.../incidents/:incId/experiments/comparison        comparison report (table + recommendation)
```

Example create:

```json
POST /v1/orgs/org_9f/incidents/inc_2c/experiments
{
  "hypothesisId": "hyp_1",
  "proposedChange": {
    "kind": "change_configuration",
    "target": { "serviceId": "svc_checkout", "environment": "sandbox" },
    "change": { "path": "db.pool.max", "from": 10, "to": 50 },
    "reversible": true
  },
  "environment": "replay",
  "workload": { "type": "incident_replay", "from": "2026-10-01T14:00:00Z", "to": "2026-10-01T14:10:00Z" },
  "expectedOutcome": { "criteria": ["error_rate < 0.02 within PT5M"], "window": "PT10M" },
  "budget": { "maxDurationSeconds": 900, "maxCostUnits": 100 }
}
→ 201 { "data": { "id": "exp_77", "state": "PENDING", "result": null } }
```

## Remediation & approvals

```text
POST  /v1/orgs/:orgId/incidents/:incId/plans                 AI proposes plan (or retrieval of last)
GET   /v1/orgs/:orgId/plans/:planId                         plan w/ validation result
POST  /v1/orgs/:orgId/plans/:planId/approval-requests        request approval { requestedBy, ttl }
GET   /v1/orgs/:orgId/approvals?state=PENDING               queue for approver
POST  /v1/orgs/:orgId/approvals/:aprId/decide               { decision: APPROVE|REJECT, note }
POST  /v1/orgs/:orgId/plans/:planId/execute                 execute approved plan → AgentExecution
GET   /v1/orgs/:orgId/executions/:exeId                    step-by-step execution + before/after
GET   /v1/orgs/:orgId/executions/:exeId/verification       criteria evaluation results
```

Execution only succeeds on a plan whose approval matches the current `planHash` — a changed plan invalidates outstanding approvals.

## Agent executions

```text
GET   /v1/orgs/:orgId/agent-executions?incident=&state=          runs w/ cost/tokens/provider
GET   /v1/orgs/:orgId/agent-executions/:exeId/tool-calls         full tool trace (audited)
```

## Policies (control plane)

```text
GET/PUT   /v1/orgs/:orgId/policies/autonomy            { level, perEnvironment overrides }
GET/PUT   /v1/orgs/:orgId/policies/actions             allowlist/denylist, blast-radius limits, rate limits
POST      /v1/orgs/:orgId/kill-switch                  { scope: org|project, reason }   → halt AI plane
DELETE    /v1/orgs/:orgId/kill-switch                 release
```

## Realtime events (WebSocket)

```text
WSS /v1/realtime   (auth via signed ticket from POST /v1/realtime/ticket)
```

Client messages:

```json
{ "op": "subscribe", "entity": "service", "scope": "org_9f.prj_2.env_prod", "filters": ["latency > 200"], "fields": ["latency","errors","status"] }
{ "op": "subscribe", "channel": "incidents", "scope": "org_9f" }
{ "op": "unsubscribe", "id": "<subId>" }
```

Server events: `DiffEvent` (PATCH/SNAPSHOT/DELETE/ALERT, [10-data-model.md](10-data-model.md)), `incident.*` (state transitions, timeline entries), `experiment.*` (state changes), `approval.*` (request/decision), `execution.*` (step progress, verification result). Reconnect protocol: SNAPSHOT-then-PATCH with resumable sequence ids per subscription.

## Error codes (common)

| Code | Meaning |
|---|---|
| `unauthenticated` / `forbidden` | auth / policy denial (policy denials include reason and audit id) |
| `invalid_plan` | plan validation failure w/ per-step reasons |
| `blast_radius_exceeded` | plan exceeds Twin-computed limit |
| `budget_exceeded` | tool/experiment budget |
| `reconstruction_gaps` | historical query with incomplete event coverage |
| `conflict` | stale approval / changed planHash |

## Related documents

UX flows over these APIs: [13-dashboard-ux.md](13-dashboard-ux.md) · Data shapes: [10-data-model.md](10-data-model.md) · Ingestion protocol: [11-sdk-and-ingestion.md](11-sdk-and-ingestion.md) · Safety enforcement points: [08-safety-and-autonomy.md](08-safety-and-autonomy.md)