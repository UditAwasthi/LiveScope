# 01 — Product Vision

> Status: [PROPOSED] — this document defines what LiveScope is becoming. The current repository implements only a fraction of it (see [README — Current Status](../README.md#current-status) and [18-roadmap.md](18-roadmap.md)).

## Product name

**LiveScope**

## One-line description

LiveScope is an AI-native observability and autonomous reliability platform that observes production, investigates incidents, reconstructs what happened, experiments with fixes in an isolated environment, and safely applies and verifies the remediation.

Tagline: **Observe. Reproduce. Fix. Verify.**

## Product thesis

Traditional observability tools stop at the moment of detection. They draw a red graph and send a page. Everything after the page — investigation, hypothesis formation, change evaluation, execution, verification, learning — is manual human work performed under time pressure.

LiveScope's thesis is that the expensive and error-prone part of reliability engineering is not *detecting* problems but *deciding what to do about them* — and that this decision can be made dramatically safer and faster by a system that:

1. **Grounds every conclusion in evidence** collected from real telemetry.
2. **Reconstructs the incident** rather than guessing from dashboards.
3. **Experiments with candidate fixes in a safe environment** before touching production.
4. **Executes reversibly, verifies empirically, and rolls back** when verification fails.
5. **Remembers every incident** and uses that memory in future reasoning.

The core product loop:

```text
OBSERVE → DETECT → INVESTIGATE → UNDERSTAND → RECONSTRUCT →
EXPERIMENT → COMPARE FIXES → EXECUTE → VERIFY → ROLLBACK IF NEEDED → LEARN
```

The key insight: an AI agent that *immediately modifies production* because it believes a fix will work is a liability. An AI that *demonstrates* a fix works before proposing it — with measured evidence, bounded risk, and a rollback path — is trustworthy. That demonstration environment is the **Fix Lab** (see [05-fix-lab.md](05-fix-lab.md)).

## Problem

Modern distributed systems produce more telemetry than any human can synthesize:

- A single incident may involve dozens of services, hundreds of metrics, thousands of log lines, and traces spanning many processes.
- Detection is solved: threshold and anomaly alerts fire reliably. **Diagnosis is not solved.**
- The incident commander performs a manual search: correlate alerts, diff deployments, read logs, query traces, form hypotheses, test each one mentally, pick the least risky intervention, apply it, and hope.
- This work is slow (hours), error-prone (wrong root cause → wrong fix → second outage), and unscalable (knowledge lives in a few senior engineers' heads).
- Post-incident, most of the reasoning is lost. The same incident class recurs and is re-diagnosed from scratch.

Existing tools optimize the *observation* step. None of them close the loop from **"the system is telling you something is wrong"** to **"here is a fix that demonstrably works, applied safely, and verified."**

## Vision

The maturity ladder LiveScope climbs:

```text
Monitoring            — "Something is wrong"            (graphs + thresholds)
    ↓
Observability          — "Here is the evidence"          (metrics, logs, traces, topology)
    ↓
AI Investigation       — "Here is why it broke"          (evidence-grounded diagnosis)
    ↓
AI-Assisted Remediation— "Here are fixes that work"      (Fix Lab experiments, human approves)
    ↓
Safe Autonomous Remediation — "Fixed it, verified, documented"  (policy-bounded execution)
    ↓
Predictive Reliability — "It will break; prevent it"     (pre-incident simulation)
```

Each rung is a shippable product. LiveScope does not skip rungs — autonomous remediation without investigation and verification capability is not autonomy, it is gambling with production.

## Target users

Initially:

- **Backend engineers** operating distributed services who want faster answers than "go read the logs."
- **DevOps engineers** responsible for deployments, configuration, and infrastructure health.
- **SREs / incident commanders** who need evidence synthesis, candidate-fix comparison, and safe execution.
- **Engineering teams** operating microservice systems without a dedicated 24/7 SRE org (the majority of the market).

Not initially targeted: platform teams needing a general-purpose cloud management console, non-technical stakeholders, or teams whose entire stack is serverless vendor-managed.

## Core product principles

1. **Evidence before action.** No AI conclusion without cited telemetry. Every diagnosis links to the exact metrics, logs, traces, and changes that support it.
2. **Simulation before production changes.** If a fix can be tested in the Fix Lab before production, it must be. (See [05-fix-lab.md](05-fix-lab.md).)
3. **Least privilege.** The AI gets the minimum tool access needed for the current task. Mutating tools require policy authorization. ([08-safety-and-autonomy.md](08-safety-and-autonomy.md))
4. **Human control.** Humans set the autonomy policy. The system escalates to humans by default; automation is granted per-policy, never assumed. ([08-safety-and-autonomy.md](08-safety-and-autonomy.md))
5. **Verification over assumption.** No remediation is considered successful merely because a command returned success. Recovery must be observed in production telemetry. (Rule 9.)
6. **Reversibility.** Prefer reversible remediation strategies. Every mutating action must define its rollback strategy before execution.
7. **Explainability.** Every AI decision is auditable: what was observed, what was inferred, what was considered, what was rejected, and why.
8. **Tenant isolation.** One organization's telemetry, incidents, and AI actions can never affect another's. ([14-security.md](14-security.md))
9. **Reliability over novelty.** When a simple deterministic mechanism works (threshold alerts, scripted rollbacks), do not use an LLM for it. The LLM is used for synthesis, not for tasks that already have reliable tools.

## What LiveScope is NOT

- **Not a metrics dashboard or Grafana clone.** Dashboards exist as an interface to the system's understanding, not as the product. Grafana is a good dashboard; LiveScope is a reliability engine that happens to show dashboards.
- **Not a log viewer.** Logs are evidence input, not the product surface.
- **Not a chatbot.** There is an assistant interface, but it is grounded in tools, evidence, and the Fix Lab — not free-form generation. A chatbot without tool access and evidence citation cannot do this job and is explicitly not the goal.
- **Not a generic coding agent.** LiveScope may generate pull requests as *one* remediation type, but it is not an autonomous developer.
- **Not an unrestricted infrastructure agent.** The AI never receives unrestricted shell or production access. All actions flow through a permissioned, audited tool layer. ([07-agent-tools.md](07-agent-tools.md))
- **Not a Datadog clone.** We do not aim to match Datadog's breadth of integrations, dashboards, and agents. We aim to close the detection→remediation loop that Datadog leaves open.

## Related documents

- Requirements: [02-product-requirements.md](02-product-requirements.md)
- System overview: [03-system-overview.md](03-system-overview.md)
- Fix Lab: [05-fix-lab.md](05-fix-lab.md)
- Safety: [08-safety-and-autonomy.md](08-safety-and-autonomy.md)
- Explicit non-goals: [20-non-goals.md](20-non-goals.md)