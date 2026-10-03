# 05 — Fix Lab

> Status: `[PROPOSED]` — the most important product capability not yet built. Fix Lab is what separates LiveScope from both dashboards and "AI agent with kubectl" products.

## Concept

Fix Lab is LiveScope's **controlled environment for evaluating remediation strategies before applying them to production, whenever technically feasible.**

The principle: an AI that *believes* a fix will work is a hypothesis generator. An AI that *demonstrates* a fix works — in an isolated environment, against reconstructed incident conditions, with measured outcomes — is a reliability system. Fix Lab is the mechanism that converts beliefs into evidence.

Fix Lab guarantees, in increasing strength:

1. **Counterfactual reasoning** — "based on the reconstructed incident and known system behavior, this change would likely have prevented/repaired the degradation" (lowest cost, always available).
2. **Replay verification** — "we re-ran the incident against this change and observed the outcome."
3. **Sandbox execution** — "we ran the change in an isolated environment with real workloads and measured it."
4. **Shadow verification** — "we ran production-shaped traffic against the candidate change next to the current version and compared."

Production is **never** modified by a Fix Lab experiment. Every experiment writes to isolated resources tagged with the experiment ID; teardown is guaranteed.

## Core workflow

```text
Incident
   ↓
Evidence          (from System Twin + telemetry; see 06-ai-architecture)
   ↓
Hypotheses        (multiple, ranked, with citations)
   ↓
Reconstruction    (rebuild incident-time state from Twin historical layer)
   ↓
Candidate fixes   (one per viable hypothesis)
   ↓
Experiment        (run each candidate in the strongest feasible experiment type)
   ↓
Measure           (recorded, comparable metrics)
   ↓
Compare           (recovery · risk · blast radius · performance · cost · confidence)
   ↓
Select            (recommend safest effective fix, with reasoning)
   ↓
Approve           (per autonomy policy; see 08-safety-and-autonomy)
   ↓
Execute           (Action Engine; see 07-agent-tools)
   ↓
Verify            (production telemetry must confirm recovery)
```

## FixExperiment

The unit of Fix Lab work:

```text
FixExperiment
  id:                    uuid
  incidentId:            references Incident
  baselineState:         ref → System Twin reconstruction at incident T0
                         (snapshot id + reconstruction report: events applied, gaps)
  hypothesisId:          which root-cause hypothesis this fix addresses
  proposedChange:        structured change spec (see below) — NOT freeform text
  environment:           counterfactual | replay | sandbox | shadow | production-shadow
  workload:              description + ref (replayed period, synthetic profile, shadow stream)
  expectedOutcome:       machine-checkable success criteria
                         (e.g. error_rate < 1% within 5 min; p99 < 250ms sustained 10 min)
  observedOutcome:       measurements from the experiment (empty until run)
  risk:                  assessed pre-run (see Risk model) and revised post-run
  blastRadius:           entities potentially affected (from Twin dependency graph)
  duration:              planned + actual runtime; hard timeout enforced
  confidence:            0–1, calibrated against benchmark ground truth (see 16-ai-evaluation)
  result:                PENDING | RUNNING | SUCCEEDED | FAILED | INCONCLUSIVE | ABORTED
  cost:                  resources consumed (sandbox size × time), for comparison
  audit:                 every step logged (see 14-security)
```

`proposedChange` is a **structured change spec**, validated against the tool schema before the experiment can run:

```json
{
  "kind": "change_configuration",
  "target": { "serviceId": "checkout-api", "environment": "staging-sim" },
  "change": { "path": "db.pool.max", "from": 10, "to": 50 },
  "reversible": true,
  "rollbackStrategy": "restore previous value"
}
```

## Risk model

Every candidate fix is scored **before** and **after** experimentation:

| Dimension | Meaning | Example |
|---|---|---|
| Recovery probability | Likelihood the fix restores healthy behavior | 0.85 |
| Risk | Probability/impact of the fix *causing* harm | low/med/high + rationale |
| Blast radius | Set of entities affected, from Twin graph | `checkout-api` + 2 dependents |
| Performance | Resource/cost impact of the fix itself | +1 replica ≈ $0.12/hr |
| Cost | Experiment cost + remediation cost | sandbox: 8 min × 2 vCPU |
| Confidence | How much we trust the experiment result | calibrated per experiment type |

Blast radius is computed from the System Twin dependency graph, not estimated by the LLM ([04-system-twin.md](04-system-twin.md) § 8).

## Experiment types

Ordered by evidence strength and cost. MVP ships types 1–2; the rest are staged in the roadmap ([18-roadmap.md](18-roadmap.md)).

### 1. Counterfactual replay — `[PROPOSED, MVP]`

> **What would the system state have looked like if this change had existed at the time of the incident?**

- Reconstruct incident-time state from the Twin historical layer, apply the proposed change to the model, and evaluate the expected trajectory against known system behavior (baselines, dependency behavior).
- Cheapest experiment; available for *every* incident because it needs only stored telemetry.
- Produces a **prediction with confidence**, not a demonstration. Fix Lab labels it as such: never present counterfactual results as "tested."
- Limitation: only as good as the Twin's model fidelity — confidence is capped accordingly.

### 2. Config / dependency simulation — `[PROPOSED, MVP-adjacent]`

- Evaluate configuration changes and dependency failure/latency scenarios against the Twin model without executing anything: e.g. "pool max=50 → expected utilization 62%, no exhaustion."
- Includes **dependency simulation**: mark dependency X failed/slow in the model and reason about downstream effects (shared machinery with chaos-toolkit `[FUTURE]`, but offline/model-based).

### 3. Replay (historical traffic) — `[PLANNED, P1]`

- Re-run actual stored incident-period traffic/events against a sandbox deployment (staging-sim or ephemeral namespace) with and without the candidate fix; diff the outcomes.
- Requires: snapshot+replay `[PLANNED]` in projection engine, workload capture, sandbox orchestration.
- Evidence strength: real past traffic, real code, isolated environment.

### 4. Sandbox execution — `[PLANNED, P1]`

- Deploy the candidate fix into a temporary isolated environment; drive it with synthetic or replayed workloads; measure.
- Guarantees: namespace/label-scoped resources, hard TTL, automatic teardown, no production network egress beyond explicitly allowlisted dependencies.

### 5. Shadow traffic — `[FUTURE]`

- Mirror a sample of *live* production traffic to a candidate version running in isolation; compare behavior against the production version on the same traffic.
- Highest pre-production evidence; also the most operationally complex (traffic mirroring, data safety, cost). P2.

### 6. Chaos experiment — `[FUTURE]`

- Controlled fault injection **in a sandbox or, rarely, production-like staging** to validate a remediation hypothesis (e.g. "service X survives dependency Y failing at 50% after the fix"). Builds on the scaffolded chaos-engine concept.

| Type | MVP/P1/Future | Runs real code? | Uses real traffic? | Production risk |
|---|---|---|---|---|
| Counterfactual replay | MVP | No (model) | Historic (model) | None |
| Config/dependency simulation | MVP-adjacent | No (model) | Historic (model) | None |
| Replay | P1 | Yes | Historic (real) | None (isolated) |
| Sandbox | P1 | Yes | Synthetic/replayed | None (isolated) |
| Shadow traffic | Future | Yes | Live (copied) | None-to-low (read-only mirror) |
| Chaos experiment | Future | Yes | Synthetic | Bounded (sandbox policy) |

## Comparison and selection

For one incident, Fix Lab runs N experiments (typically 2–4 candidate fixes, budgeted) and produces a comparison table — the artifact shown in the approval UI ([13-dashboard-ux.md](13-dashboard-ux.md)):

| | Fix A — Rollback deploy | Fix B — Raise pool size | Fix C — Scale +3 replicas |
|---|---|---|---|
| Recovery probability | 0.91 | 0.86 | 0.42 |
| Risk | Low (reversible, known-good version) | Low (single config path) | Medium (cost, masks symptom) |
| Blast radius | checkout-api (+2 dependents) | checkout-api | checkout-api, cluster capacity |
| Time to recovery (predicted/observed) | ~3 min | ~2 min | unknown symptom relief |
| Experiment type | Counterfactual + replay | Replay | Counterfactual only |
| Confidence | 0.8 | 0.75 | 0.3 |
| Cost | low | low | +$0.36/hr ongoing |

Selection rule: **safest effective fix, not fastest or most confident** — policy-weighted (weights set by the control plane; defaults favor risk↓ then confidence↑ then time↓ then cost↓). The recommendation always includes the full comparison; humans can overrule.

## Fail-safe behaviors

- Any experiment exceeding duration/cost budget → `ABORTED`, resources torn down.
- Sandbox health checks detect runaway experiments → kill + teardown + flag.
- If no candidate reaches the policy confidence threshold → incident moves to `ESCALATED` to humans with the evidence gathered so far. **Fix Lab never pushes a low-confidence fix forward silently.**
- Experiment failures never alter the incident record destructively; they are recorded as outcomes (that *is* the learning).

## What Fix Lab is not

- Not a staging environment product: it uses ephemeral, scoped environments, not a permanent staging cluster users maintain.
- Not a load-testing tool: workloads are incident-derived, goal-limited, budget-bound.
- Not a place where "the agent tried something in prod" gets retroactively labeled. If it touched production, it went through the Action Engine, not Fix Lab.

## Dependencies

- System Twin historical layer (`[PLANNED]` snapshot+replay is the substrate) — [04-system-twin.md](04-system-twin.md)
- Incident Engine records — [09-incident-engine.md](09-incident-engine.md)
- Tool layer experiment tools — [07-agent-tools.md](07-agent-tools.md)
- Safety policy for experiment permissions — [08-safety-and-autonomy.md](08-safety-and-autonomy.md)
- Evaluation against ground truth — [16-ai-evaluation.md](16-ai-evaluation.md) (predicted-vs-observed correlation is the core quality metric of Fix Lab)

## Related documents

Vision context: [01-product-vision.md](01-product-vision.md) · Requirements FR-010/FR-015: [02-product-requirements.md](02-product-requirements.md) · AI planning loop: [06-ai-architecture.md](06-ai-architecture.md) · Approval UI: [13-dashboard-ux.md](13-dashboard-ux.md)