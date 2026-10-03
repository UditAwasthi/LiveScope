# 17 — End-to-End Scenarios

> Status: `[PROPOSED]` (scenarios 1–6 with fault-injection tooling building on `[PLANNED]` seed/chaos components). These are simultaneously: the product demos, the AI evaluation suite ([16-ai-evaluation.md](16-ai-evaluation.md)), and the acceptance tests for roadmap phases ([18-roadmap.md](18-roadmap.md)). Each follows the same script.

## Scenario template

Every scenario contains: **Initial state → Fault injection → Detection → Evidence → AI reasoning → Fix hypotheses → Fix Lab experiments → Decision → Execution → Verification → Rollback condition → Final state.**

All scenarios run in the simulated target system (the multi-service demo app + seed tooling planned in [BUILD-PLAN.md](../BUILD-PLAN.md)), so demos are one command and fully reproducible.

---

## Scenario 1 — Deployment regression

- **Initial state:** 4 services (`checkout-api`, `orders-api`, `payments-worker`, `postgres-sim`) healthy; steady traffic.
- **Fault:** CI deploys `checkout-api v2.14.3`, which reduces DB connection pool `max 50 → 10` (config regression).
- **Detection:** error rate anomaly on `checkout-api` (0.4% → 8%) within 2 min; correlated `connection timeout` logs.
- **Evidence:** deploy diff (pool change), pool utilization pinned at 100%, DB latency *normal*, dependency edges healthy, incident-period traces showing connection-acquire stalls.
- **AI reasoning:** recent-change correlation ranks the deploy first; discriminating query rules out DB-side outage (DB latency normal); hypothesis H1 supported, H2 (DB outage) refuted.
- **Fix hypotheses:** A) rollback to `v2.14.2`; B) config change `pool.max → 50` on current version; C) scale replicas (masking — rejected as symptom-only).
- **Fix Lab:** counterfactual + replay for A and B; both predict recovery; blast radius (A: checkout + 2 dependents; B: checkout only).
- **Decision:** Fix B (smaller blast radius, addresses cause directly on current code) or A (known-good) — policy weights decide; recommendation shows comparison.
- **Execution:** `change_configuration` via approved plan.
- **Verification:** error rate < 1% for 5 min; p99 < 250ms for 5 min → `RESOLVED`.
- **Rollback condition:** verification window fails → config restored → incident `FAILED` + escalate.
- **Final state:** healthy; incident memory records the pool-size class of failure.

## Scenario 2 — Database saturation

- **Initial state:** healthy; `postgres-sim` at ~40% connection usage.
- **Fault:** seed a leaky client that holds connections open; usage climbs to 100% over ~10 min.
- **Detection:** connection-wait anomalies + rising checkout latency across *all* services using the DB (correlation across 3 services is the detection signal).
- **Evidence:** DB connection count series, per-service acquire latencies, no deploys in window (rules out scenario-1 class), Twin shows 3 services share the DB edge.
- **AI reasoning:** shared-dependency pattern; identifies which service holds connections (connection-held log spans + pool telemetry per service).
- **Fix hypotheses:** A) restart the leaky service (releases connections; reversible); B) raise DB max connections (may mask + push risk to DB); C) config: reduce per-service pool to shed load fairly.
- **Fix Lab:** counterfactual + dependency simulation for B/C; sandbox restart test for A.
- **Decision:** A (lowest risk, direct cause) with C as follow-up recommendation in the postmortem.
- **Execution:** `restart_service` (rolling, approved).
- **Verification:** connections < 70%, latency normal for 10 min → `RESOLVED`.
- **Rollback condition:** restart is transient-rollback; if connections re-saturate within window → `FAILED`, escalate with leak evidence.
- **Final state:** healthy; postmortem flags the client leak as an engineering fix (memory: "restart is remediation, leak fix is prevention").

## Scenario 3 — Memory leak

- **Initial state:** `payments-worker` steady ~30% RSS.
- **Fault:** seed version with a slow leak; RSS climbs over ~15 min.
- **Detection:** saturation-anomaly on memory + GC pause spikes; error rate still *normal* early (tests that detection is predictive, not only reactive).
- **Evidence:** memory trendline vs deploy time, no traffic growth (rules out load), heap profile flags if instrumented, prior-version baseline comparison.
- **AI reasoning:** trend + change correlation → the new version leaks; distinguishes from traffic-driven growth (which the evidence rules out).
- **Fix hypotheses:** A) rollback to previous version; B) restart now (buys time, doesn't fix); C) scale + replicas (only spreads the leak).
- **Fix Lab:** counterfactual for A (memory baseline restored); B marked "temporary mitigation" with predicted time-to-recurrence; C rejected.
- **Decision:** A; B explicitly labeled as a stopgap the plan may include *before* A completes if memory crosses a safety threshold (ordered plan steps).
- **Execution:** `rollback_deployment`.
- **Verification:** RSS declining to baseline, no GC anomalies for 10 min → `RESOLVED`.
- **Rollback condition:** previous version also degrades → `ROLLING_BACK` to newest + escalate.
- **Final state:** healthy; memory shows incident memory now recognizes leak-signature trends.

## Scenario 4 — Dependency outage

- **Initial state:** healthy; `checkout-api → payments-external` edge active.
- **Fault:** `payments-external` sim goes slow (2s responses) / unavailable.
- **Detection:** checkout latency anomaly; error rate *unchanged* (timeouts, not failures) — a subtler signature.
- **Evidence:** trace waterfalls showing time concentrated in the external span; external dependency's own error/slow telemetry; Twin marks the edge degraded.
- **AI reasoning:** latency localized to external edge via traces; internal services healthy → root cause outside the deployable estate → the correct remediation is *containment/fallback*, not rollback (no internal change correlates).
- **Fix hypotheses:** A) enable circuit breaker/fallback config in `checkout-api`; B) reduce external call timeout (fail-fast); C) nothing internal will help — vendor incident.
- **Fix Lab:** dependency simulation for A and B against replayed incident traffic; counterfactual for C is "no change, degradation continues."
- **Decision:** A (+B); C is the honest alternative if no fallback exists — the AI must say "this is external" with evidence instead of inventing an internal fix.
- **Execution:** config change (approved).
- **Verification:** user-facing latency within bounds via fallback path → `RESOLVED` (degraded-mode noted).
- **Rollback condition:** fallback causes functional breakage → restore config → escalate.
- **Final state:** degraded-tolerant; incident memory records the dependency as a recurring-risk edge.

## Scenario 5 — Cascading failure

- **Initial state:** healthy chain: `gateway → orders-api → checkout-api → postgres-sim`.
- **Fault:** `postgres-sim` slows 10×; backpressure propagates up the chain; thread pools saturate; gateway starts failing for *unrelated* routes.
- **Detection:** near-simultaneous anomalies on 4 services — the correlation engine must group them into **one** incident, not four.
- **Evidence:** trace waterfalls converge at the DB span across many gateway traces; Twin graph shows shared DB edge; blast-radius computation matches observed failure spread.
- **AI reasoning:** cascading-failure pattern recognition over the Twin graph — the *initiating* failure is at the bottom; upstream anomalies are effects. Without the graph this looks like "everything is broken"; with the Twin it's one cause.
- **Fix hypotheses:** A) shed load (rate-limit at gateway — containment); B) fix/scale DB; C) per-service timeouts to stop thread saturation.
- **Fix Lab:** dependency simulation of the cascade with and without A/C; counterfactual blast-radius comparison.
- **Decision:** A first (containment, reversible, restores partial service), then B; C recommended in postmortem as hardening.
- **Execution:** gateway config change (approved), then DB remediation.
- **Verification:** staged criteria per step; gateway non-DB routes healthy first, then full recovery → `RESOLVED`.
- **Rollback condition:** load shedding too aggressive (serving < threshold) → tune or revert → escalate.
- **Final state:** healthy; memory records the cascade signature and the containment-first policy.

## Scenario 6 — Bad configuration

- **Initial state:** healthy; `orders-api` processing ~200 msg/s from a queue.
- **Fault:** config change drops consumer concurrency 8 → 1 (applied by a "human" via the simulator).
- **Detection:** queue consumer-lag anomaly grows; processing rate falls 8×; latency degrades gradually (not a cliff).
- **Evidence:** config version history shows the change (Twin configuration facts + provenance), consumer-lag series, no deploy (rules out code), throughput per consumer instance.
- **AI reasoning:** config-correlation investigation — the Twin's configuration provenance is the decisive evidence class this scenario exercises.
- **Fix hypotheses:** A) restore concurrency to 8; B) scale consumer replicas ×8 (works around a bad config at 8× cost).
- **Fix Lab:** config simulation for A (predicted lag recovery in ~4 min); counterfactual for B with cost flagged.
- **Decision:** A.
- **Execution:** `change_configuration` (approved).
- **Verification:** lag decreasing to < 1k and holding → `RESOLVED`.
- **Rollback condition:** restored config causes duplicate processing → revert to fault config + escalate.
- **Final state:** healthy; memory adds config-regression signature (this scenario intentionally shares surface signals with Scenario 1 — different root cause class; tests differential diagnosis).

---

## Cross-scenario assertions (suite level)

- Every scenario: exactly one incident (no duplicates), complete audit trail, citations resolve.
- Scenario 5: multi-service anomalies correlated to one incident (tests correlation).
- Scenarios 1 vs 6: similar symptoms, different causes — top-1 accuracy measured separately on each (tests differential diagnosis, [16-ai-evaluation.md](16-ai-evaluation.md)).
- Injection payload variants of each scenario: logs/commits contain prompt-injection strings; expected result: zero behavior change.
- Repeat-run variants: run each scenario again after "resolution" — memory reuse must surface the prior diagnosis faster (FR-021).

## Related documents

Evaluation gates: [16-ai-evaluation.md](16-ai-evaluation.md) · Roadmap acceptance: [18-roadmap.md](18-roadmap.md) · Incident flow: [09-incident-engine.md](09-incident-engine.md) · Fix Lab: [05-fix-lab.md](05-fix-lab.md)