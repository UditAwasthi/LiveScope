# 13 — Dashboard UX

> Status: `[PLANNED]` (React app scaffolded, empty). This document defines the product UI per screen: purpose, user goal, data, actions, APIs, realtime behavior, and the empty/loading/error states. UI exists to expose the product loop, not to be a Grafana clone ([01-product-vision.md](01-product-vision.md) § What LiveScope is NOT).

## Global conventions

- **Realtime-first:** every screen that can be live *is* live (WebSocket diff updates, [12-api-contracts.md](12-api-contracts.md) § Realtime). No auto-refresh timers.
- Every screen defines: purpose · user goal · key data · actions · APIs · realtime behavior · empty / loading / error states.
- Evidence is always citable: any AI-generated text links to the underlying telemetry (metric ranges, log ids, trace ids).

## Overview

- **Purpose:** "is anything wrong right now" in one glance.
- **User goal:** 5-second triage.
- **Data:** active incidents (severity, state, affected services), org health summary, recent alerts, live system-wide status.
- **Actions:** open incident, open service, trigger investigation.
- **APIs:** `GET /incidents?state=active`, `GET /services`, realtime `incidents.*`, `DiffEvent`.
- **Realtime:** incident banner appears on `incident.created`; state chips update live.
- **Empty:** "No active incidents — last incident 3 days ago" + health snapshot. **Loading:** skeleton cards. **Error:** connection status chip + cached data with staleness label.

## Services

- **Purpose:** catalog with health at a glance.
- **Key data:** grid of service cards: status, error rate, latency, version, deploy recency, freshness.
- **Actions:** drill into service detail; pin filters.
- **APIs:** `GET /services`; realtime `DiffEvent` PATCHes on subscribed fields.
- **States:** empty ("Waiting for telemetry — SDK quickstart link"), loading skeleton, error → stale card labeled `stale · last update 00:42`.

## Service detail

- **Purpose:** one service's full live picture.
- **Key data:** live metrics (error rate, latency percentiles, throughput, saturation), current deployment (version, age, who), config summary, dependencies (in/out edges with confidence), recent incidents.
- **Actions:** view logs/traces for this service; open topology centered here; time-travel slider (state at T).
- **APIs:** `GET /services/:id`, `/deployments`, `/configuration`, `/twin/relationships?from=`.
- **Realtime:** metric panels live via `DiffEvent`; deployment change animates a banner.
- **States:** empty (no telemetry yet), loading, error with retry + staleness.

## Metrics / Logs / Traces screens

- **Purpose:** direct evidence exploration (human-first; the AI uses the same data via tools).
- **Metrics:** query builder (service, metric, range, agg) over `POST /metrics/query`; compare ranges.
- **Logs:** filter by service/level/range + full-text; each row links to its trace if present.
- **Traces:** list (slow/err) → waterfall detail with per-span latency/error highlights and cross-service jump.
- **APIs:** [12-api-contracts.md](12-api-contracts.md) § Telemetry queries.
- **Realtime:** optional tail mode ("follow") via stream subscription; capped to protect the browser.
- **States:** all three have explicit "no results in range" empties; queries cap results and offer narrower-range hints.

## Service topology

- **Purpose:** dependency map from the System Twin; blast-radius intuition.
- **Key data:** graph of Twin entities/edges; edge confidence + freshness styling (solid/dashed); live error propagation highlighting during incidents.
- **Actions:** click edge → call stats; "what depends on X" query; export snapshot.
- **APIs:** `GET /topology`, realtime updates on Twin change events.
- **States:** empty (needs traces first), partial (some edges inferred-only — always shown as such), error → cached graph with staleness.

## Incidents list

- **Purpose:** inbox of what happened/is happening.
- **Key data:** incidents with state machine chip, severity, services, duration, owner, recurrence badge (linked prior incidents).
- **Actions:** filter by state/severity/service; open investigation.
- **APIs:** `GET /incidents`, realtime `incident.*`.

## Incident investigation

- **Purpose:** the working surface for one incident — the flagship screen.
- **Key data (tabs):**
  - **Timeline:** append-only, mixed human/AI entries, each state transition attributed.
  - **Diagnosis:** hypotheses ranked, each with supports/contradicts and **citations that open the exact metric range / log / trace**; confidence + calibration badge.
  - **Evidence:** the evidence packet (anomaly scores, exemplar logs/traces) as first-class objects.
  - **Experiments:** Fix Lab comparison (below).
  - **Remediation:** plan steps w/ risk, blast radius, rollback; execution status; verification live.
- **Actions:** ack/own incident; add annotation; trigger/re-run investigation; request remediation plan; approve; watch execution live.
- **APIs:** incident detail, `investigate`, `diagnosis`, `plans`, `approvals`, `executions`, realtime `incident.*` / `execution.*`.
- **States:** investigating → live streaming AI progress ("querying slow traces… checking deploy diff…"); AI unavailable → `ESCALATED` banner with human-action guidance.

## Fix Lab (experiment comparison)

- **Purpose:** make "which fix is safest" undeniably clear. This is the differentiator surface ([05-fix-lab.md](05-fix-lab.md)).

```text
┌─────────────────────────────────────────────────────────────┐
│ PRODUCTION INCIDENT · inc_2c · SEV2 · checkout-api degraded │
│                                                             │
│ Cause hypothesis (H1, confidence 0.82, calibrated):         │
│   Deploy v2.14.3 cut db.pool.max 50→10 → pool exhaustion.    │
│   [evidence: deploy diff] [evidence: pool utilization]      │
│                                                             │
│ Candidate fixes — 2 experiments completed, 1 pending budget │
│                                                             │
│ ┌────────────────────────────┐ ┌──────────────────────────┐ │
│ │ Fix A — Rollback deploy    │ │ Fix B — Raise pool size  │ │
│ │ Experiment: replay  ✅ done │ │ Experiment: replay ✅ done│ │
│ │ Recovery probability  0.91  │ │ Recovery probability 0.86 │ │
│ │ Risk            LOW         │ │ Risk            LOW       │ │
│ │ Blast radius    checkout +2 │ │ Blast radius    checkout  │ │
│ │ Time to recover  ~3 min     │ │ Time to recover  ~2 min  │ │
│ │ Confidence      0.80        │ │ Confidence      0.75      │ │
│ │ Cost            low         │ │ Cost            low      │ │
│ │ [View experiment details]   │ │ [View experiment details] │ │
│ └────────────────────────────┘ └──────────────────────────┘ │
│                                                             │
│ Recommendation: Fix A — safest effective fix (policy weights)│
│        [ Compare in Fix Lab ]   [ Prepare remediation plan ] │
└─────────────────────────────────────────────────────────────┘
```

- **Rules:** experiment-type labels are always shown (a counterfactual result must never be styled like a sandbox result); "observed" vs "predicted" is visually distinct; comparison table exportable.
- **Actions:** create experiment (budgeted), abort experiment, open raw experiment record, select fix → plan preparation.
- **APIs:** `POST /experiments`, `GET /experiments/:id`, `/experiments/comparison`, `abort`.
- **Realtime:** experiment state changes stream in (`experiment.running`, `experiment.succeeded`).
- **States:** no candidates yet (shows why — hypothesis confidence, budget), budget exhausted (explicit cap display), experiment failed (shown as evidence, not hidden).

## Remediation approval

- **Purpose:** one-screen human decision ([08-safety-and-autonomy.md](08-safety-and-autonomy.md) § Human-in-the-loop).
- **Key data:** plan steps (each: action, target, risk, blast radius, rollback strategy, timeout), validation result (all checks pass), linked experiment evidence, who requested, expiry countdown.
- **Actions:** Approve / Reject (with note); "Approve & watch" opens live execution timeline; delegate.
- **States:** plan-invalid (never reachable for approval — rejected earlier with reasons), approval expired (explains re-plan), `AUTO_SAFE`-eligible plans show "will execute automatically under policy" with the policy citation.

## Agent execution timeline

- **Purpose:** full transparency of AI + Action Engine behavior.
- **Key data:** vertical timeline of every tool call (name, inputs summary, result status, duration), plan-step progress, before/after states, verification criteria evaluations in real time.
- **Actions:** open any tool call for full I/O; jump to cited evidence; kill-switch access for admins (with confirm + reason).
- **Realtime:** `execution.*` events; verification progress bar with per-criterion live status.
- **States:** running, completed (green criteria list), rolled back (shows which criterion failed and rollback receipt), halted (kill-switch receipt).

## Settings

- **Purpose:** control plane surface.
- **Key data:** org/project, members & roles, API keys (create/revoke; plaintext shown once), autonomy level (with explanation of each level and required evaluation history), action policies (allow/deny lists, blast-radius limits, rate limits), retention settings, integrations status.

## Integrations

- **Purpose:** connections that make the Twin and Action Engine work.
- **Key data:** Kubernetes/cluster connection (health, scope), CI/deploy webhooks, Git provider, OTel collector endpoint (with copy-paste config), incident notification channels (Slack/webhook `[PROPOSED]`).
- **States:** each integration shows: connected/degraded/disconnected + last sync + least-privilege scope summary ([14-security.md](14-security.md)).

## Accessibility & quality bar

- Every realtime element has a non-realtime fallback path (fresh GET).
- Any AI text is visually distinguished from measured data; citations are links, not screenshots of text.
- Error states always offer: what failed, what's cached, how to retry, where the audit trail is.

## Related documents

Fix Lab semantics: [05-fix-lab.md](05-fix-lab.md) · Incident surface: [09-incident-engine.md](09-incident-engine.md) · Safety UX: [08-safety-and-autonomy.md](08-safety-and-autonomy.md) · APIs: [12-api-contracts.md](12-api-contracts.md)