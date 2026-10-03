# 20 — Non-Goals

> Purpose: prevent scope explosion. Everything listed here is a deliberate **"not now" or "not ever"** — any pull request implementing one of these must point at this document and lose.

## Not ever (product identity boundaries)

- **An unrestricted production agent.** The AI never receives shell access, ambient credentials, or unregistered capabilities — structurally, not by prompt ([08-safety-and-autonomy.md](08-safety-and-autonomy.md), [07-agent-tools.md](07-agent-tools.md)).
- **A general cloud management platform.** No VPC editors, no IAM consoles, no invoice dashboards. LiveScope manages *reliability*, and touches infrastructure only through scoped, registered tools.
- **A Grafana/Datadog clone.** We will not chase dashboard breadth, marketplace integrations, or per-team chart aesthetics ([01-product-vision.md](01-product-vision.md) § What LiveScope is NOT). Evidence and the incident loop are the product; visualization serves them.
- **A chatbot product.** Conversational UI exists as an *interface* to tools and evidence, not as free-form generation.
- **Arbitrary destructive actions.** Denylist is structural: no DB drops/schema migrations by agent, no resource deletion, no secret rotation/exposure, no `--force` anything, no `kubectl exec`-style command execution ([07-agent-tools.md](07-agent-tools.md) § Destructive operations).
- **Fully autonomous database migrations.** Never automated by the agent, at any autonomy level. Migration PRs *may* be proposed via `create_pull_request` for humans to review and run.
- **A generic coding agent.** Code changes surface only as remediation artifacts (PR proposals); no drive-by refactors, no feature work, no unsolicited improvements.

## Not initially (deferred; needs an explicit roadmap decision to enter scope)

- **Every programming language SDK.** Node/TS first (with OTLP covering everyone else at 90% function); other native SDKs only on demonstrated demand.
- **Every cloud/provider.** Kubernetes-first for execution; other deploy targets wait for the integration framework to exist.
- **Full autonomy (`AUTONOMOUS` level).** Defined in the taxonomy for precision, not scheduled. Promotion gates are metric-driven and unstated for this level until Phase 7 evidence exists ([16-ai-evaluation.md](16-ai-evaluation.md)).
- **Hosted multi-tenant SaaS.** The repo targets a self-hostable product first; cell-based tenancy etc. is a later business decision (AD-04/05 scale questions).
- **Real multi-region operation.** Region simulation now; true multi-region (MirrorMaker-style) after the core loop is solid ([15-reliability.md](15-reliability.md)).
- **Predictive reliability.** Phase 8 `[FUTURE]`; enters scope only after Phase 7 gates ([18-roadmap.md](18-roadmap.md)).
- **Replacing existing DevOps tooling.** LiveScope integrates with CI/CD, K8s, and Git; it does not replace them.
- **Mobile apps, on-call scheduling, status pages.** Adjacent product spaces we explicitly decline (they belong to PagerDuty/status-page products until someone makes a case that changes this document).
- **Learning from *other* tenants' incidents ("fleet intelligence").** Out until cross-tenant privacy design exists; incident memory is per-org ([14-security.md](14-security.md) tenant isolation).
- **Automated performance marketing claims.** Benchmarks only from the reproducible suite; no vibes-based numbers ([16-ai-evaluation.md](16-ai-evaluation.md)).

## Scope-explosion tripwires

If a proposal shows any of these signals, it belongs here:

- Adds a new stateful datastore without an ADR arguing consolidation first ([19-architecture-decisions.md](19-architecture-decisions.md)).
- Adds an agent/tool without registry schema + policy + audit path ([07-agent-tools.md](07-agent-tools.md)).
- Adds a dashboard surface not tied to evidence or the incident loop ([13-dashboard-ux.md](13-dashboard-ux.md)).
- Adds an LLM where a deterministic mechanism exists (Rule 9: reliability over novelty).
- Widens AI capability without widening the evaluation suite first ([16-ai-evaluation.md](16-ai-evaluation.md)).
- Renames an existing concept instead of reusing it (terminology is contract: [10-data-model.md](10-data-model.md)).