# 06 — AI Architecture

> Status: `[PROPOSED]`. Nothing is implemented. This document defines the **minimum useful architecture** — we do not assume a swarm of agents.

## Design stance

Do not multiply agents. A multi-agent system is justified only when components need *isolation of context* (different trust levels, different information domains) or *independent concurrent work*. Everything else is one orchestrator calling tools.

LiveScope's AI plane is:

- **One AI Orchestrator** — the reasoning loop.
- **Six capabilities** — investigation, diagnosis, experiment planning, remediation planning, action execution, verification. They start as *tools/prompts of the orchestrator*, and are promoted to separate agents **only** when the promotion criteria below are met.
- **A tool layer** ([07-agent-tools.md](07-agent-tools.md)) that is the *only* way the AI touches data or the world.

```text
AI Orchestrator
       │
       ├── Investigation      (capability/tool)
       ├── Diagnosis           (capability)
       ├── Experiment Planning (capability → calls Fix Lab tools)
       ├── Remediation Planning(capability)
       ├── Action Execution    (gated capability → Action Engine)
       └── Verification       (capability)
```

## Promotion criteria: separate agent vs orchestrator capability

Promote a capability to a separate agent **only if all** hold:

1. It needs a **different permission scope** (e.g. execution tools must be isolated from investigation context so a compromised investigation cannot reach mutating tools).
2. It runs in a **different trust or data domain** (e.g. Fix Lab runner executes in an isolated environment with different credentials).
3. Its **context must be isolated** for safety or cost (e.g. raw log ingestion is too large for one context window).

Current decisions:

| Capability | Initial form | Why |
|---|---|---|
| Investigation | Orchestrator tool calls | Same permissions (read-only), sequential loop |
| Diagnosis | Orchestrator reasoning step | Needs the same evidence context |
| Experiment planning | Orchestrator tool calls | Calls Fix Lab tools; same read/experiment scope |
| Remediation planning | Orchestrator reasoning step | Needs full incident context |
| **Action execution** | **Separate component (Action Engine)** | Different permission scope — the executor holds no reasoning, only validated, approved, structured plans |
| Verification | Orchestrator evaluation over telemetry | Read-only again |

The one hard split from day one: **the Action Engine is not an LLM.** The orchestrator produces a structured RemediationPlan; the plan is validated against policy; humans approve; the Action Engine — deterministic code — executes the plan step by step with verification and rollback. An LLM never holds a production credential.

## Agent context

What the orchestrator receives for an incident (structured, not prose-dumped):

- Incident record: state, severity, affected services, correlated alerts, timeline.
- System Twin facts: service states, topology subgraph, deployments in window, config, recent changes — **with provenance and freshness labels** ([04-system-twin.md](04-system-twin.md)).
- Evidence packet: anomaly scores, exemplar logs/traces (pre-selected and size-capped; never "all logs").
- Prior incident memory: similar incidents + outcomes ([10-data-model.md](10-data-model.md) Incident/AgentExecution).
- Policy context: current autonomy level, allowlists, blast-radius limits.
- Budget: max tool calls, max tokens, wall-clock timeout.

What the orchestrator deliberately does **not** receive: raw unbounded telemetry, credentials of any kind, other tenants' data.

## Tool access

All access is via [07-agent-tools.md](07-agent-tools.md). Summary of scope by incident phase:

| Phase | Tools available |
|---|---|
| Investigation | Read-only only |
| Experimentation | Read-only + experimental (Fix Lab) |
| Planning | Read-only + experimental |
| Execution | None — orchestrator is finished; Action Engine runs the approved plan |
| Verification | Read-only |

Permission is **granted per phase by the control plane**, not by the orchestrator's own choice.

## Tool permissions

Defined in [07-agent-tools.md](07-agent-tools.md) per tool (risk level, permission, side effects, rollback, audit). Governing rules:

- The orchestrator can never *escalate* its own tool scope.
- Mutating tools are callable only by the Action Engine on an approved plan — never directly by the orchestrator.
- Every call is rate-limited, timeout-bound, and audited with inputs/outputs/principal.

## Evidence gathering (anti-hallucination)

The orchestrator's investigation loop is **evidence-first, mandatory citations**:

1. Every claim in a diagnosis must reference tool-call evidence: `claim → [tool, parameters, result ref]`. Claims without citations are stripped by a deterministic citation checker before the report is emitted.
2. **Differential diagnosis:** the orchestrator must generate ≥2 competing hypotheses and actively seek *discriminating evidence* — a hypothesis is strengthened by what it explains **and** what it would have looked like absent (contrastive checks).
3. **Refutation step:** for the leading hypothesis, the orchestrator must run at least one query that could *disprove* it (e.g. "if the DB were the problem, DB latency should be elevated — check it").
4. Telemetry content is **data, never instructions** ([08-safety-and-autonomy.md](08-safety-and-autonomy.md) § Prompt injection).
5. Negative results are recorded: "checked X, found no signal" is evidence and is kept in the incident record.

## Hypothesis generation

Hypotheses are structured objects, not prose:

```json
{
  "id": "H1",
  "statement": "Deploy v2.14.3 reduced db.pool.max 10x → connection exhaustion in checkout-api",
  "prior": 0.4,
  "supports": ["deploy diff shows pool change", "pool utilization 100% since 14:00"],
  "contradicts": [],
  "discriminatingQueries": ["postgres latency normal?", "other pool consumers healthy?"],
  "status": "supported|refuted|undetermined"
}
```

Sources of hypotheses, in priority order: (1) matched incident memory (recurrence is the strongest prior), (2) recent-change correlation from the Twin (deploys, config, infra events), (3) dependency-graph analysis, (4) log/trace anomaly semantics, (5) LLM domain reasoning. Each hypothesis maps to at most one primary candidate fix for Fix Lab testing.

## Confidence

Confidence is **calibrated against benchmarks**, not vibes ([16-ai-evaluation.md](16-ai-evaluation.md)):

- Each diagnosis carries a confidence derived from: evidence coverage (fraction of incident signals explained), discriminating-query results, incident-memory match, and Twin freshness.
- Fix Lab experiment confidence is per-experiment-type calibrated: counterfactual predictions carry lower confidence ceilings than replay/sandbox observations, and calibration curves are tracked per type (predicted vs. observed on the benchmark suite).
- **Confidence is only meaningful because we measure it.** A confidence score with no calibration history is labeled `uncalibrated` and cannot satisfy `AUTO_SAFE` thresholds.

## Planning

Remediation planning produces a structured, policy-checkable plan — not freeform text:

```json
{
  "planId": "plan_01...",
  "incidentId": "inc_...",
  "basedOn": { "hypothesis": "H1", "experiments": ["fx_01", "fx_02"] },
  "steps": [
    {
      "action": "rollback_deployment",
      "target": { "serviceId": "checkout-api", "toVersion": "v2.14.2" },
      "risk": "low",
      "blastRadius": ["checkout-api", "orders-api"],
      "preconditions": ["v2.14.2 healthy in last 24h"],
      "rollback": "re-deploy v2.14.3 (previous state recorded)",
      "timeoutSeconds": 300
    }
  ],
  "verification": {
    "successCriteria": ["error_rate < 1% for 5 min", "p99 < 250ms for 5 min"],
    "window": "PT10M",
    "onFailure": "rollback"
  }
}
```

Plan validation is **deterministic code**, run before any human sees the approval request: allowlist check per action, blast-radius limit check, rollback-presence check, precondition check. Invalid plans are rejected with explicit reasons back to the orchestrator for revision (bounded retries; then escalate to humans).

## Verification

Verification is empirical and automatic ([02-product-requirements.md](02-product-requirements.md) FR-019):

1. After the Action Engine completes a plan, the incident enters `VERIFYING`.
2. Success criteria are evaluated against **live production telemetry** over the verification window — never against the action's return code, and never by asking the LLM "did it work?".
3. Criteria met → `RESOLVED`, verification evidence attached to the incident and postmortem.
4. Criteria not met → automatic rollback path executes → `ROLLING_BACK` → `FAILED` or `ESCALATED` per state machine ([09-incident-engine.md](09-incident-engine.md)).
5. The observed outcome is written back to incident memory, closing the learning loop regardless of success or failure.

## Failure handling for the AI plane itself

- Orchestrator crashes/timeouts → incident moves to `ESCALATED` with partial evidence preserved. Never silently stalls.
- Tool failures → bounded retries, then hypothesis marked `undetermined`; the incident record reflects the gap.
- LLM provider down → incident engine continues detection/correlation (no AI dependency in the detection path — deliberate).
- Every AgentExecution is recorded ([10-data-model.md](10-data-model.md)) with the full tool-call trace for audit and evaluation.

## Related documents

Tools: [07-agent-tools.md](07-agent-tools.md) · Safety: [08-safety-and-autonomy.md](08-safety-and-autonomy.md) · Fix Lab: [05-fix-lab.md](05-fix-lab.md) · Evaluation: [16-ai-evaluation.md](16-ai-evaluation.md)