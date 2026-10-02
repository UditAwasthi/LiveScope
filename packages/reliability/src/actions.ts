import type { ActionClass } from './policy';

export interface PlanStep {
  action: ActionClass;
  service: string;
  rollback: string;
  argument?: string;
}

export interface AuditRecord {
  at: number;
  kind: string;
  detail: string;
}

export interface Cluster {
  versions: Record<string, string>;
  previous: Record<string, string>;
  replicas: Record<string, number>;
  restarted: string[];
  fallbacks: string[];
  configs: Record<string, string>;
}

export class KillSwitch {
  halted = false;
  stoppedAt = 0;

  emergency(now: number): void {
    this.halted = true;
    this.stoppedAt = now;
  }
}

export interface ExecutionResult {
  ok: boolean;
  status: 'verified' | 'rolled_back' | 'halted';
  audit: AuditRecord[];
}

export function executePlan(input: {
  steps: PlanStep[];
  cluster: Cluster;
  approved: boolean;
  auto: boolean;
  kill: KillSwitch;
  now: number;
  verify: (cluster: Cluster) => boolean;
}): ExecutionResult {
  const audit: AuditRecord[] = [];
  const before = structuredClone(input.cluster);
  if (!input.approved && !input.auto) {
    audit.push({ at: input.now, kind: 'denied', detail: 'missing approval' });
    return { ok: false, status: 'halted', audit };
  }
  audit.push({
    at: input.now,
    kind: 'approval',
    detail: input.auto ? 'policy auto' : 'human approved',
  });

  for (const step of input.steps) {
    if (input.kill.halted) {
      audit.push({ at: input.kill.stoppedAt, kind: 'kill_switch', detail: 'emergency stop' });
      restore(input.cluster, before);
      return { ok: false, status: 'halted', audit };
    }
    applyStep(input.cluster, step);
    audit.push({ at: input.now, kind: 'execute', detail: `${step.action} ${step.service}` });
  }

  if (!input.verify(input.cluster)) {
    restore(input.cluster, before);
    audit.push({ at: input.now, kind: 'rollback', detail: 'verification failed' });
    return { ok: false, status: 'rolled_back', audit };
  }
  audit.push({ at: input.now, kind: 'verified', detail: 'success criteria met' });
  return { ok: true, status: 'verified', audit };
}

function applyStep(cluster: Cluster, step: PlanStep): void {
  if (step.action === 'rollback_deployment') {
    const previous = cluster.previous[step.service];
    if (previous) cluster.versions[step.service] = previous;
    return;
  }
  if (step.action === 'scale_service') {
    cluster.replicas[step.service] = Number(step.argument ?? 2);
    return;
  }
  if (step.action === 'restart_service') {
    cluster.restarted.push(step.service);
    return;
  }
  if (step.action === 'enable_fallback') {
    cluster.fallbacks.push(step.service);
    return;
  }
  cluster.configs[step.service] = step.argument ?? 'previous';
}

function restore(cluster: Cluster, before: Cluster): void {
  cluster.versions = { ...before.versions };
  cluster.previous = { ...before.previous };
  cluster.replicas = { ...before.replicas };
  cluster.restarted = [...before.restarted];
  cluster.fallbacks = [...before.fallbacks];
  cluster.configs = { ...before.configs };
}
