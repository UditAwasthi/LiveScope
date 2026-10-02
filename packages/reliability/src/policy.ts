export type Autonomy = 'OBSERVE_ONLY' | 'ASSISTED' | 'APPROVAL_REQUIRED' | 'AUTO_SAFE';

export type ActionClass = 'rollback_deployment' | 'scale_service' | 'restart_service' | 'restore_config' | 'enable_fallback';

const AUTO_SAFE_ACTIONS = new Set<ActionClass>(['rollback_deployment', 'restart_service']);

export interface PolicyDecision {
  mode: 'deny' | 'approval' | 'auto';
  reasons: string[];
}

export function evaluatePolicy(input: {
  autonomy: Autonomy;
  action: ActionClass;
  blastRadius: number;
  blastLimit: number;
  hasRollback: boolean;
  violations: number;
}): PolicyDecision {
  const reasons: string[] = [];
  if (!input.hasRollback) reasons.push('rollback strategy required');
  if (input.blastRadius > input.blastLimit) reasons.push('blast radius exceeds limit');
  if (input.violations > 0) reasons.push('policy violations block execution');
  if (input.autonomy === 'OBSERVE_ONLY' || input.autonomy === 'ASSISTED') reasons.push('autonomy does not allow mutation');
  if (reasons.length > 0) return { mode: 'deny', reasons };
  if (input.autonomy === 'AUTO_SAFE' && AUTO_SAFE_ACTIONS.has(input.action)) {
    return { mode: 'auto', reasons: ['pre-approved action class'] };
  }
  return { mode: 'approval', reasons: ['human approval required'] };
}

export function canPromote(history: { verified: number; violations: number }, from: Autonomy, to: Autonomy): boolean {
  if (from === 'APPROVAL_REQUIRED' && to === 'AUTO_SAFE') {
    return history.verified >= 3 && history.violations === 0;
  }
  return false;
}
