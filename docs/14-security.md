# 14 — Security Architecture

> Status: `[PROPOSED]`. Nothing is implemented except the local Docker stack (which currently runs with no auth — development convenience, explicitly not a production posture).

## Trust model summary

| Component | Trust | Rationale |
|---|---|---|
| Control plane (auth, policy, audit) | Highest | All authorization decisions originate here |
| Human users/approvers | Highest within their role | Role-scoped, audited |
| Action Engine | High, narrow | Deterministic executor; holds scoped short-lived creds per execution |
| Fix Lab environments | Low-medium | Isolated; deny-by-default egress |
| AI orchestrator | **Medium, capability-bounded** | No credentials, no direct access; only registry tools ([07-agent-tools.md](07-agent-tools.md)) |
| Telemetry / all external content | **Untrusted** | Attacker-controllable; data-not-instruction ([08-safety-and-autonomy.md](08-safety-and-autonomy.md) § Prompt injection) |

## Authentication

- **Humans:** SSO/OIDC with short-lived tokens; MFA for approver/admin roles `[PROPOSED]`.
- **Services/SDK:** scoped API keys (ingest or read); hashed at rest, shown once, revocable, rotatable; per-key rate limits and quotas.
- **Internal service-to-service:** mTLS within the deployment boundary `[FUTURE]`; signed internal tokens before that.

## Authorization

- **RBAC roles:** `viewer` (read), `approver` (approve remediation; subset of admin), `admin` (policy, keys, kill switch, autonomy level).
- **Every query is org-scoped by credential**, never by caller-supplied org id — cross-tenant access is structurally impossible, and an automated tenant-isolation test suite is a release gate (NFR-1, [02-product-requirements.md](02-product-requirements.md)).
- **Policy engine decisions** (tool grants, plan validation, autonomy) are made server-side; clients only receive outcomes.

## Tenant isolation

- `org_id` on every row; enforced at the data-access layer (single choke point), verified by tests that attempt cross-org reads with every role and every API.
- Realtime subscriptions are scope-bound to the authenticated ticket's org/projects ([12-api-contracts.md](12-api-contracts.md) § Realtime).
- Fix Lab environments are org-tagged; teardown sweeps anything with an experiment tag and no live experiment record.

## Secrets & credentials

- **Storage:** never in telemetry, never in logs, never in Twin facts. `get_configuration` tool and config APIs redact declared secret patterns server-side before response ([07-agent-tools.md](07-agent-tools.md)).
- **Gateway/API keys:** hashed (Argon2id) at rest; audit on create/use/revoke.
- **Integration credentials (K8s, CI, Git):** stored encrypted (envelope encryption, KMS or equivalent) in the control plane; **never** passed to the AI plane.
- **Action Engine executions:** short-lived, scoped credentials minted per execution (e.g. a Kubernetes ServiceAccount token limited to the target namespace and the action's verb, TTL = plan timeout + slack), destroyed after execution. No persistent agent credentials exist anywhere — this is the enforcement of "no LLM holds production credentials" ([08-safety-and-autonomy.md](08-safety-and-autonomy.md)).

## Infrastructure integrations (least privilege)

- Kubernetes: dedicated ServiceAccount; verbs limited to what mutating tools need (`deployments.get/list/patch`, `pods.list` — **no exec, no secrets read, no cluster-admin**); namespace-scoped where the target allows.
- CI/Git: read for evidence (commits, diffs, PRs), write only for the `create_pull_request` tool's dedicated bot identity; never deploy keys.
- Egress: Fix Lab sandboxes allowlist dependencies explicitly; default deny ([05-fix-lab.md](05-fix-lab.md)).

## Agent permissions & tool isolation

- Registry-enforced tool scope per incident phase ([07-agent-tools.md](07-agent-tools.md)); denylist structural; unknown tools fail closed.
- Audit log is append-only, covers every tool call, plan validation, approval, action, and policy change ([10-data-model.md](10-data-model.md) ToolCall/Approval).
- Kill switch and emergency stop: [08-safety-and-autonomy.md](08-safety-and-autonomy.md).

## Prompt injection & malicious telemetry

- Telemetry is untrusted input end-to-end: schema validation + size caps at the gateway; data-not-instruction framing in the AI context; the **only** real defense is architectural — the orchestrator has no mutation capability, plans are deterministically validated, and the Action Engine is not an LLM ([06-ai-architecture.md](06-ai-architecture.md), [08-safety-and-autonomy.md](08-safety-and-autonomy.md) § Prompt injection).
- Malicious telemetry against the data plane (poison payloads, exhaustion) is handled by schema validation, per-key quotas, DLQ isolation, and resource caps ([15-reliability.md](15-reliability.md)).
- Injection resistance is continuously tested ([16-ai-evaluation.md](16-ai-evaluation.md) § Agent safety): any successful injection-escalation in the suite is a release blocker.

## GitHub/CI security

- Webhook payloads (deploy events) are untrusted external content: signature-verified at ingest, schema-validated, and treated as data by the AI plane.
- PRs created by `create_pull_request` are always authored by the dedicated bot identity, never by user tokens, and never auto-merged.

## Production access

- Production mutations flow only through: policy → plan validation → approval (`APPROVAL_REQUIRED`) or `AUTO_SAFE` class → Action Engine with per-execution scoped credentials → verification ([09-incident-engine.md](09-incident-engine.md)).
- No human or agent "debug mode" that bypasses audit exists. If an engineer needs direct access, they use their own credentials outside LiveScope — LiveScope's audit boundary stays intact.

## Encryption

- In transit: TLS everywhere external (gateway, API, WebSocket); mTLS internal `[FUTURE]`.
- At rest: database-level encryption; secrets envelope-encrypted (above); audit log integrity via append-only storage and hash chaining `[PROPOSED]`.

## Data retention & privacy

- Retention table: [10-data-model.md](10-data-model.md). User-configurable within policy floors; audit retention ≥1y.
- Telemetry may contain user-adjacent data (order ids, emails in logs): redaction hooks at the SDK ([11-sdk-and-ingestion.md](11-sdk-and-ingestion.md)) and PII-scrub options at ingestion; docs must warn users not to log secrets into *any* observability tool.
- Deletion: org deletion purges all stores (Kafka topics by key, TS partitions, control-plane rows) — verified by a deletion test.

## Threat checklist (living)

| Threat | Primary defense | Doc |
|---|---|---|
| Prompt injection via telemetry/logs/commits | Capability-bounded AI + deterministic plan validation | [08-safety-and-autonomy.md](08-safety-and-autonomy.md) |
| Compromised SDK key | Scopes, quotas, revocation, anomaly on abuse | this doc |
| Cross-tenant leakage | Credential-scoped queries + release-gate tests | this doc |
| Rogue action by AI | Registry scope + plan validation + approval + Action Engine isolation | [07-agent-tools.md](07-agent-tools.md) |
| Credential theft from LiveScope | Envelope encryption, per-execution minted creds, no agent creds | this doc |
| Insider/audit tampering | Append-only audit, hash chaining, admin actions also audited | this doc |
| Sandbox escape / resource abuse in Fix Lab | Isolated namespaces, egress deny, budgets, guaranteed teardown | [05-fix-lab.md](05-fix-lab.md) |

## Related documents

Safety policy: [08-safety-and-autonomy.md](08-safety-and-autonomy.md) · Tools registry: [07-agent-tools.md](07-agent-tools.md) · Reliability (poison messages, overload): [15-reliability.md](15-reliability.md) · ADRs incl. K8s/mTLS timing: [19-architecture-decisions.md](19-architecture-decisions.md)