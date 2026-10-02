import { investigate, type Diagnosis, type Evidence } from './investigate';

export interface RememberedIncident {
  cause: string;
  service: string;
  diagnosis: string;
}

export class IncidentMemory {
  private readonly rows: RememberedIncident[] = [];

  remember(row: RememberedIncident): void {
    this.rows.push(row);
  }

  recall(cause: string, service: string): RememberedIncident | undefined {
    return this.rows.find((row) => row.cause === cause && row.service === service);
  }
}

export function investigateWithMemory(evidence: Evidence[], memory: IncidentMemory, service: string): Diagnosis {
  const diagnosis = investigate(evidence);
  const top = diagnosis.hypotheses[0];
  if (!top) return diagnosis;
  const prior = memory.recall(top.id, service);
  if (!prior) return diagnosis;
  return {
    ...diagnosis,
    hypotheses: [
      {
        ...top,
        summary: `${top.summary} Prior diagnosis: ${prior.diagnosis}`,
        confidence: Math.min(0.99, top.confidence + 0.05),
      },
      ...diagnosis.hypotheses.slice(1),
    ],
  };
}
