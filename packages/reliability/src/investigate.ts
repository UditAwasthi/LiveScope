export interface Evidence {
  id: string;
  kind: 'metric' | 'log' | 'trace' | 'deploy' | 'config';
  summary: string;
  at: number;
}

export interface Hypothesis {
  id: string;
  summary: string;
  confidence: number;
  evidenceIds: string[];
}

export interface Diagnosis {
  hypotheses: Hypothesis[];
  toolCalls: string[];
}

const READ_TOOLS = ['get_metrics', 'get_logs', 'get_traces', 'get_twin'] as const;

export function investigate(evidence: Evidence[]): Diagnosis {
  const toolCalls = [...READ_TOOLS];
  const usable = evidence.filter((item) => !item.summary.toLowerCase().includes('ignore previous instructions'));
  const hypotheses: Hypothesis[] = [];

  const deploy = usable.find((item) => item.kind === 'deploy');
  const error = usable.find((item) => item.kind === 'metric' && item.summary.includes('error'));
  if (deploy && error) {
    hypotheses.push({ id: 'deployment_regression', summary: 'A new deployment correlates with the error rise.', confidence: 0.86, evidenceIds: [deploy.id, error.id] });
  }

  const db = usable.find((item) => item.kind === 'metric' && item.summary.includes('connections'));
  if (db) {
    hypotheses.push({ id: 'database_saturation', summary: 'Database connections are exhausted.', confidence: 0.8, evidenceIds: [db.id] });
  }

  const memory = usable.find((item) => item.kind === 'metric' && item.summary.includes('memory'));
  if (memory) {
    hypotheses.push({ id: 'memory_leak', summary: 'Process memory is climbing without bound.', confidence: 0.78, evidenceIds: [memory.id] });
  }

  const dependency = usable.find((item) => item.kind === 'trace' && item.summary.includes('dependency'));
  if (dependency) {
    hypotheses.push({ id: 'dependency_outage', summary: 'Latency originates in an upstream dependency.', confidence: 0.82, evidenceIds: [dependency.id] });
  }

  const cascade = usable.filter((item) => item.kind === 'trace' && item.summary.includes('cascade'));
  if (cascade.length > 0) {
    hypotheses.push({ id: 'cascading_failure', summary: 'The first failing service initiated the cascade.', confidence: 0.84, evidenceIds: cascade.map((item) => item.id) });
  }

  const config = usable.find((item) => item.kind === 'config');
  const latency = usable.find((item) => item.kind === 'metric' && item.summary.includes('latency'));
  if (config && latency) {
    hypotheses.push({ id: 'bad_configuration', summary: 'A configuration change tracks the latency regression.', confidence: 0.83, evidenceIds: [config.id, latency.id] });
  }

  hypotheses.sort((left, right) => right.confidence - left.confidence);
  return { hypotheses, toolCalls };
}
