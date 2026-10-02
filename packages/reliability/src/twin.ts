export interface TwinFact {
  service: string;
  version: string;
  health: string;
  at: number;
  provenance: 'declared' | 'inferred';
  source: string;
}

export interface TwinEdge {
  from: string;
  to: string;
  provenance: 'declared' | 'inferred';
  at: number;
}

export class SystemTwin {
  private facts: TwinFact[] = [];
  private edges: TwinEdge[] = [];

  observe(fact: TwinFact): void {
    this.facts.push(fact);
  }

  connect(edge: TwinEdge): void {
    this.edges.push(edge);
  }

  current(service: string, now: number): { fact?: TwinFact; stale: boolean; ageMs: number } {
    const history = this.facts.filter((fact) => fact.service === service && fact.at <= now);
    const fact = history.at(-1);
    if (!fact) return { stale: true, ageMs: Number.POSITIVE_INFINITY };
    const ageMs = now - fact.at;
    return { fact, stale: ageMs > 60_000, ageMs };
  }

  at(service: string, timestamp: number): TwinFact | undefined {
    return this.facts.filter((fact) => fact.service === service && fact.at <= timestamp).at(-1);
  }

  dependencies(service: string): TwinEdge[] {
    return this.edges.filter((edge) => edge.from === service);
  }

  dependents(service: string): TwinEdge[] {
    return this.edges.filter((edge) => edge.to === service);
  }
}
