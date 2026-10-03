# 07 — Agent Tools

> Status: `[PROPOSED]`. No tool layer exists. This document defines the interface contract the AI plane is allowed to use — nothing outside this document is callable by the AI, and the AI can never extend it at runtime.

## Principles

1. **Tools are the only world interface.** No shell, no raw SQL, no direct Kubernetes/HTTP access, no file system. Ever.
2. **Every tool is registered with a schema; unregistered calls are impossible** (the tool registry is server-side, not in the LLM's context).
3. **Mutating tools are not callable by the reasoning loop** — only by the Action Engine on an approved plan (see [06-ai-architecture.md](06-ai-architecture.md)).
4. **Every tool result is data, never instruction.** Output is passed back as structured content; anything that looks like directives inside telemetry/log content is inert by construction (see [08-safety-and-autonomy.md](08-safety-and-autonomy.md) § Prompt injection).

## Tool categories and risk levels

| Category | Risk level | Callable by orchestrator? | Callable by Action Engine? |
|---|---|---|---|
| Read-only | none/low | ✅ (per phase policy) | ✅ |
| Experimental | medium (isolated env) | ✅ (during experimentation phase, budget-bound) | ✅ |
| Mutating | high (production) | ❌ never | ✅ only on approved plan |
| Destructive | critical | ❌ never | Only with explicit policy + approval + irreversible-action acknowledgment |

---

## Read-only tools

| name | purpose | inputs | outputs | risk | side effects | rollback | audit |
|---|---|---|---|---|---|---|---|
| `query_metrics` | Time-series query over stored metrics | service, metric, range, agg, filters | Series + provenance | none | none | n/a | ✅ |
| `search_logs` | Structured/full-text log search | service, range, level, pattern, limit | Matching entries (capped) | none | none | n/a | ✅ |
| `get_trace` | Fetch a trace by id | traceId | Spans, waterfall data | none | none | n/a | ✅ |
| `get_service_state` | Twin state for a service, optionally at time T | serviceId, at? | State + freshness + provenance | none | none | n/a | ✅ |
| `get_deployment_history` | Deployments for a service in a range | serviceId, range, includeDiff? | Deployments, diffs | none | none | n/a | ✅ |
| `get_git_changes` | Commits/PRs associated with a deployment | deploymentId or range | Change summaries (no secrets) | low | none | n/a | ✅ |
| `get_system_topology` | Dependency subgraph | serviceId?, depth?, direction? | Nodes, edges w/ confidence+freshness | none | none | n/a | ✅ |
| `get_incident_history` | Prior incidents (by service or similarity) | serviceId?, embeddingQuery?, limit | Incidents + outcomes | none | none | n/a | ✅ |
| `get_configuration` | Current config for a service | serviceId | Config values (redacted secrets) | none | none | n/a | ✅ |
| `get_incident` | Full incident record incl. evidence, hypotheses | incidentId | Incident record | none | none | n/a | ✅ |
| `compare_time_ranges` | Metric behavior A vs B (before/after, weekday-aligned) | service, metric, rangeA, rangeB | Statistical comparison | none | none | n/a | ✅ |

Notes: all ranges are capped server-side (e.g. max 7 days, max result sizes); `get_configuration` performs secret redaction server-side before return ([14-security.md](14-security.md)).

## Experimental tools (Fix Lab)

| name | purpose | inputs | outputs | risk | side effects | rollback | audit |
|---|---|---|---|---|---|---|---|
| `create_fix_experiment` | Create a FixExperiment for a candidate fix | incidentId, hypothesisId, change spec, environment type, budget | FixExperiment (PENDING) | medium | Allocates isolated resources (for sandbox types) | Teardown guaranteed by TTL | ✅ |
| `replay_incident` | Re-run stored incident traffic in sandbox | experimentId, timeRange, targetEnv | Replay report | medium | Ephemeral sandbox resources | Teardown | ✅ |
| `run_candidate_fix` | Apply the candidate change inside the experiment env | experimentId | Applied-change confirmation | medium (isolated only) | Changes only inside sandbox | Sandbox teardown | ✅ |
| `simulate_traffic` | Drive synthetic/replayed load in sandbox | experimentId, profile | Load run report | medium | Sandbox-only load | Teardown | ✅ |
| `simulate_dependency` | Fault/latency injection in sandbox (model or sandbox) | experimentId, dependency, fault | Simulation report | medium | Sandbox/model only | Teardown/reset | ✅ |
| `get_experiment_results` | Fetch measurements for an experiment | experimentId | ObservedOutcome | none | none | n/a | ✅ |
| `compare_experiments` | Structured comparison of N experiments | experimentIds[] | Comparison table (recovery, risk, blast radius, cost, confidence) | none | none | n/a | ✅ |
| `abort_experiment` | Abort + teardown | experimentId | Aborted + teardown receipt | medium | Releases resources | (is the rollback) | ✅ |

Guards: every experiment tool enforces the experiment budget (duration, cost, resource caps) declared in `create_fix_experiment`; violations auto-abort. Sandbox environments have no production network egress except explicitly allowlisted dependencies.

## Mutating tools (Action Engine only)

| name | purpose | inputs | outputs | risk | side effects | rollback strategy | audit |
|---|---|---|---|---|---|---|---|
| `rollback_deployment` | Deploy a previous known-good version | serviceId, targetVersion | Execution result + before/after state | high | Production change | Re-deploy previous version (recorded) | ✅ |
| `restart_service` | Rolling restart | serviceId, strategy | Execution result | high | Brief availability risk per instance | Restart is self-rollback (transient) | ✅ |
| `scale_service` | Change replica count | serviceId, replicas (bounded by policy) | Execution result | high | Capacity/cost change | Restore previous replica count | ✅ |
| `change_configuration` | Apply a config change | serviceId, path, value | Execution result + diff | high | Behavior change | Restore previous value (recorded pre-change) | ✅ |
| `deploy_version` | Deploy a specific version | serviceId, version/commit | Execution result | high | Production change | rollback_deployment | ✅ |
| `create_pull_request` | Open a PR with a code/config fix | repo, branch, changes, description | PR URL | medium | VCS only; no deploy | Close PR; git revert | ✅ |

All mutating tools require: an approved RemediationPlan step referencing them, per-step timeout, rate limits, precondition evaluation, and before/after state capture. They are **integrations-driven** (Kubernetes API, deployment system APIs) — never shell commands.

## Destructive operations (denylist by default)

These are **never available as agent tools in any autonomy level**; they exist only as human-run operational procedures, or as explicitly-designed narrow tools after a dedicated security review (not planned for v1):

- database schema migrations / table drops
- deletion of resources (topics, databases, buckets, namespaces)
- secret/credential rotation or exposure
- `kubectl exec`-style arbitrary command execution
- firewall/security-group changes
- data purges or retention overrides
- anything `--force` / irreversible

The denylist is enforced structurally: **these tools simply do not exist in the registry.** Policy cannot add them; adding one is a code change + security review ([08-safety-and-autonomy.md](08-safety-and-autonomy.md), [20-non-goals.md](20-non-goals.md)).

## Tool specification contract

Every tool (registered server-side) carries:

```yaml
name: rollback_deployment
purpose: Deploy a previous version of a service
riskLevel: high
permission: action-engine + approved plan + policy allowlist
rateLimit: { maxPerMinute: 2, perServiceCooldown: 5m }
timeoutSeconds: 300
inputs:  { serviceId: string, targetVersion: string }
preconditions: [ targetVersion exists, targetVersion healthy in last 24h ]
sideEffects: [ production deployment change ]
capture: [ beforeState, afterState ]
rollbackStrategy: "rollback_deployment(serviceId, previousVersion)"
auditFields: [ principal, planId, incidentId, inputs, outputs, duration, result ]
```

Registry rules:

- Tool list per incident phase is computed **server-side from policy**, then advertised to the orchestrator. The orchestrator cannot see tools it is not allowed to call.
- Unknown/renamed tool calls fail closed (error, audited) — they do not search for a best match.
- Rate limits and budgets are enforced at the registry, not trusted to the caller.

## Unresolved questions

- Exact integration surface for v1 mutating tools: Kubernetes-only, or also PaaS/CLI-based deploy systems? (See [18-roadmap.md](18-roadmap.md) Phase 6 dependency notes.)
- Whether `create_pull_request` ships in Phase 6 (code-level fixes) or is deferred — defer by default; config/deploy/scale tools cover the benchmark scenarios.

## Related documents

Safety policy that governs these tools: [08-safety-and-autonomy.md](08-safety-and-autonomy.md) · AI loop: [06-ai-architecture.md](06-ai-architecture.md) · Fix Lab experiment semantics: [05-fix-lab.md](05-fix-lab.md) · Audit/security requirements: [14-security.md](14-security.md)