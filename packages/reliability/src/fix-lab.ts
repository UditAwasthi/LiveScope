export interface FixCandidate {
  id: string;
  action: 'rollback_deployment' | 'scale_service' | 'restart_service' | 'restore_config' | 'enable_fallback';
  summary: string;
}

export interface FixScore {
  id: string;
  recoveryProbability: number;
  risk: number;
  blastRadius: number;
  confidence: number;
  predicted: string;
}

export function compareFixes(cause: string, candidates: FixCandidate[], blast: number): FixScore[] {
  return candidates.map((candidate) => {
    const aligned =
      (cause === 'deployment_regression' && candidate.action === 'rollback_deployment') ||
      (cause === 'database_saturation' && candidate.action === 'scale_service') ||
      (cause === 'memory_leak' && candidate.action === 'restart_service') ||
      (cause === 'dependency_outage' && candidate.action === 'enable_fallback') ||
      (cause === 'cascading_failure' && candidate.action === 'rollback_deployment') ||
      (cause === 'bad_configuration' && candidate.action === 'restore_config');
    return {
      id: candidate.id,
      recoveryProbability: aligned ? 0.9 : 0.35,
      risk: aligned ? 0.2 : 0.55,
      blastRadius: blast,
      confidence: aligned ? 0.8 : 0.4,
      predicted: aligned ? 'returns toward the pre-incident baseline' : 'partial or no recovery',
    };
  }).sort((left, right) => right.recoveryProbability - left.recoveryProbability - (right.risk - left.risk));
}

export function selectSafest(scores: FixScore[]): FixScore | undefined {
  return [...scores].sort((left, right) => right.recoveryProbability - left.recoveryProbability || left.risk - right.risk)[0];
}
