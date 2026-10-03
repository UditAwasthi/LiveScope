# 18 — Implementation Roadmap

> Status: this is the strategic roadmap organized around **vertical product capabilities**, not technologies. The tactical engineering sequence for the data plane is [BUILD-PLAN.md](../BUILD-PLAN.md) — it maps onto Phases 0–2 below and remains the execution checklist for that slice.

## Mapping: where the repo is today

```text
Repo today  ──┬── [IMPLEMENTED]  monorepo · Kafka+Avro pipeline · event schemas
              ├── [PLANNED]      BUILD-PLAN.md phases 0–6 (data plane through chaos/region sims)
              └── [PROPOSED]     everything in this document beyond Phase 2

Phase 0  ← BUILD-PLAN Phase 0 (foundation)
Phase 1  ← BUILD-PLAN Phases 1–2 (packages, SDK, gateway, ingestion)
Phase 2  ← BUILD-PLAN Phases 3–5 (state, streaming, dashboard, anomaly, chaos)
Phase 3+ ← new product territory (AI plane, Fix Lab, control plane)
```

---

## Phase 0 — Foundation

- **Goal:** a repo where every claim is testable: all packages build, lint, and test; CI blocks red merges.
- **User value:** indirect but decisive — velocity and honesty for everything after.
- **Work:** fill scaffolded packages with real exports; strict TS config; vitest; property tests for `vector-clock`, `crdt`, `diff-engine`; GitHub Actions; seed script cleanup. (Detail: [BUILD-PLAN.md](../BUILD-PLAN.md) Phase 0–1.)
- **Dependencies:** none.
- **Tests:** property suites green in CI.
- **Security:** none yet (local dev), but establish the audit-first convention.
- **Acceptance criteria:** clean-clone `pnpm build && pnpm test` green; CI required.
- **Demo:** none (plumbing).

## Phase 1 — Observe

- **Goal:** instrumented services stream telemetry to a live dashboard. `SDK → ingestion → telemetry → dashboard`.
- **User value:** first real value — live visibility with zero polling.
- **Work:** real gRPC gateway server; `packages/sdk`; log/trace Avro schemas; projection engine + Redis hot state; stream engine (diffs, lanes, backpressure); WebSocket gateway; React dashboard; seed-events tooling. OTLP ingestion can land late in this phase (FR-004). (Detail: [BUILD-PLAN.md](../BUILD-PLAN.md) Phases 2–4.)
- **Dependencies:** Phase 0.
- **Tests:** end-to-end round-trip (SDK→dashboard <1s); crash-recovery (kill -9 projection → converge <5s); backpressure behavior.
- **Security:** API keys + gateway auth land here (no anonymous ingestion even in dev-by-default posture); tenant model fields on every record.
- **Acceptance criteria:** FR-001..006 acceptance gates pass ([02-product-requirements.md](02-product-requirements.md)).
- **Demo:** 3 simulated services updating live; kill the producer, dashboard freezes; resume, it continues.

## Phase 2 — Understand

- **Goal:** the system knows what it is looking at: alerts, incidents, topology, deployments, history.
- **User value:** "what is wrong and what changed" without manual correlation.
- **Work:** anomaly/threshold detection (anomaly-detector); incident creation + correlation + lifecycle state machine v1 (no AI yet — detection only, [09-incident-engine.md](09-incident-engine.md)); deployment ingestion (CI webhooks/env identity); service topology from traces (Twin graph v0); snapshot+replay time-travel; Dogfood: LiveScope watches itself. (Detail: [BUILD-PLAN.md](../BUILD-PLAN.md) Phase 3/5.)
- **Dependencies:** Phase 1.
- **Tests:** fault injection → correct single incident with timeline; time-travel reconstruction matches recorded state.
- **Security:** org/project scoping enforced and tested (tenant isolation gate first run).
- **Acceptance criteria:** FR-007/FR-008/FR-013 + time-travel gates pass.
- **Demo:** inject deploy regression by hand → incident appears with evidence links; scrub timeline to before the deploy.

## Phase 3 — Investigate (AI enters, read-only)

- **Goal:** on incident creation, an AI investigation produces an evidence-cited diagnosis. **The MVP moment.**
- **User value:** "why is it broken" answered with citations in minutes.
- **Work:** control plane v0 (org model, API keys, roles — minimal); tool registry (read-only tools only, [07-agent-tools.md](07-agent-tools.md)); AI orchestrator investigation loop ([06-ai-architecture.md](06-ai-architecture.md)); citation checker; incident memory v0 (storage + retrieval); benchmark suite v1 — the six scenarios as seeded, reproducible incidents with ground truth ([17-demo-scenarios.md](17-demo-scenarios.md), [16-ai-evaluation.md](16-ai-evaluation.md)).
- **Dependencies:** Phase 2 (evidence base), LLM provider integration ([19-architecture-decisions.md](19-architecture-decisions.md)).
- **Tests:** investigation metrics gated in CI: top-1 ≥70%, evidence validity ≥95%, **zero** unauthorized tool calls.
- **Security:** autonomy is `OBSERVE_ONLY` by definition here; prompt-injection payload variants must pass (zero-escalation) before any Phase 3 merge.
- **Acceptance criteria:** FR-009/FR-011 gates pass; suite runs in CI with score regression blocking.
- **Demo:** Scenario 1 (deployment regression) auto-investigated: ranked hypotheses, each citation opens the exact metric/log/trace.

## Phase 4 — Reconstruct (System Twin proper)

- **Goal:** a first-class System Twin: live graph + historical reconstruction with provenance and freshness.
- **User value:** the substrate for Fix Lab; also direct value — "what depends on this / what did it look like at 14:02."
- **Work:** Twin entity/relationship model with provenance and staleness ([04-system-twin.md](04-system-twin.md)); graph queries as tools; consistency checks + coverage metrics; incident-scoped reconstruction API (`?at=`) with reconstruction reports.
- **Dependencies:** Phase 2 (snapshot+replay), Phase 3 (tools layer to expose).
- **Tests:** Twin answers current/historical/dependency queries on the demo topology; staleness surfaces in investigations; coverage metrics report.
- **Security:** provenance must distinguish declared vs inferred facts (no spoofed authority); config redaction server-side.
- **Acceptance criteria:** FR-014 gates pass; investigation reports now cite Twin facts with freshness.
- **Demo:** ask "what changed in the last hour on checkout-api and what depends on it" — answered as structured, cited facts.

## Phase 5 — Fix Lab

- **Goal:** candidate fixes get evaluated in isolation and compared. **The differentiator becomes real.**
- **User value:** "what will happen if we change X" with evidence, not opinion.
- **Work:** FixExperiment model + experiment budgeting ([05-fix-lab.md](05-fix-lab.md)); counterfactual replay + config/dependency simulation (MVP experiment types); experimental tools in the registry; comparison report; dashboard Fix Lab UI ([13-dashboard-ux.md](13-dashboard-ux.md)); calibration tracking begins (predicted vs observed).
- **Dependencies:** Phase 4 (Twin historical layer, blast radius), Phase 3 (planning surface).
- **Tests:** experiment-to-production correlation ≥75%, zero leaked sandboxes per suite run, comparison reports machine-checkable.
- **Security:** sandbox isolation (egress deny-by-default, TTL teardown, org-tagged resources); experiment tools only during experimentation phase.
- **Acceptance criteria:** FR-010/FR-015 gates pass; suite shows ≥2 compared candidates for each benchmark scenario.
- **Demo:** Scenario 1 with the comparison screen: Fix A (rollback) vs Fix B (config) — measured, side-by-side, recommendation visible.

## Phase 6 — Assisted Remediation

- **Goal:** approved plans execute safely and verify empirically. `APPROVAL_REQUIRED` autonomy achieved.
- **User value:** the full loop closes with a human in control.
- **Work:** remediation planning + deterministic plan validator ([06-ai-architecture.md](06-ai-architecture.md)); approval service + UI; Action Engine with per-execution scoped credentials ([14-security.md](14-security.md)); verification + automatic rollback; postmortem generation; audit completeness checks; mutating tool integrations (Kubernetes-first); kill switch + emergency stop.
- **Dependencies:** Phase 5 (evidence for plans), integration credentials surface (K8s demo cluster).
- **Tests:** mid-plan failure → rollback receipts; verification failure → auto-rollback; kill switch ≤1s; audit 100% coverage; autonomy stays `APPROVAL_REQUIRED` (promotion is Phase 7's explicit act).
- **Security:** everything in [08-safety-and-autonomy.md](08-safety-and-autonomy.md) becomes enforce-and-test, not design-only: allowlists, blast-radius caps, timeouts, rate limits, plan-hash-bound approvals.
- **Acceptance criteria:** FR-016..020 gates pass; all six scenarios run end-to-end: detect → diagnose → experiment → approve → execute → verify.
- **Demo:** the full Scenario 1 journey in one sitting, including a deliberate verification-failure variant that auto-rolls-back.

## Phase 7 — Safe Autonomy

- **Goal:** `AUTO_SAFE` — pre-approved action classes execute automatically within limits.
- **User value:** MTTR for known incident classes drops to minutes without per-incident human time.
- **Work:** policy engine (action classes, thresholds, blast-radius limits, cooldowns); promotion gates wired to evaluation history ([16-ai-evaluation.md](16-ai-evaluation.md) § Autonomy promotion gates); replay/sandbox experiment types upgraded (live-code experiments); autonomy dashboard (what auto-executed, why, outcomes).
- **Dependencies:** Phase 6 with ≥N verified remediations at target metrics.
- **Tests:** 100 simulated policy evaluations, zero unauthorized actions; injection suite clean; auto-rollback on failed verification still 100%.
- **Security:** every auto-executed action is a policy-cited, audited, reversible event; org-level rollback-to-APPROVAL switch.
- **Acceptance criteria:** FR-022 gates pass; benchmark suite runs scenarios 1, 2, 6 fully autonomously with correct behavior and full audit.
- **Demo:** deploy regression happens; before a human opens the dashboard, the rollback has already executed and verified; the incident reads like a postmortem that wrote itself.

## Phase 8 — Predictive Reliability

- **Goal:** pre-incident simulation and preventive recommendations. `[FUTURE]`
- **User value:** incidents prevented rather than fixed.
- **Work:** risk forecasting over Twin trends (capacity, saturation, leak signatures); preventive recommendations evaluated in Fix Lab; scheduled shadow/chaos validation of preventive changes; memory-driven pattern early-warning.
- **Dependencies:** Phase 7 evaluation history; forecasting quality thresholds defined first (avoid vibes-driven prediction).
- **Tests/acceptance:** predicted incidents occur ≥60% on reproducible benchmarks; recommendations carry experiment evidence; false-alarm rate bounded and reported.
- **Demo:** connection-pool exhaustion predicted 40 min ahead with a tested preventive change proposed.

---

## Phase sequencing rationale

- AI (Phase 3) comes **after** understanding (Phase 2): investigation without evidence infrastructure produces confident nonsense; the suite would score it honestly and badly.
- Fix Lab (Phase 5) comes **before** execution (Phase 6): plans without experiment evidence make approval a guessing game — reversing 5 and 6 would produce a safe-looking but hollow product.
- Autonomy (Phase 7) is **earned** by metrics, not scheduled by ambition ([16-ai-evaluation.md](16-ai-evaluation.md) gates).
- The demo scenario suite is built once (Phase 3) and reused as evaluation, regression, and product demo for every later phase — demos and tests must never diverge.

## Related documents

Tactical build detail (Phases 0–2): [BUILD-PLAN.md](../BUILD-PLAN.md) · Requirements: [02-product-requirements.md](02-product-requirements.md) · Evaluation gates: [16-ai-evaluation.md](16-ai-evaluation.md) · Safety model: [08-safety-and-autonomy.md](08-safety-and-autonomy.md)