export type IncidentStatus =
  | 'DETECTED'
  | 'INVESTIGATING'
  | 'DIAGNOSED'
  | 'EXPERIMENTING'
  | 'AWAITING_APPROVAL'
  | 'REMEDIATING'
  | 'VERIFYING'
  | 'RESOLVED'
  | 'ROLLING_BACK'
  | 'FAILED'
  | 'ESCALATED';

const EDGES: Record<IncidentStatus, IncidentStatus[]> = {
  DETECTED: ['INVESTIGATING'],
  INVESTIGATING: ['DIAGNOSED', 'ESCALATED'],
  DIAGNOSED: ['EXPERIMENTING', 'ESCALATED'],
  EXPERIMENTING: ['AWAITING_APPROVAL', 'REMEDIATING', 'FAILED'],
  AWAITING_APPROVAL: ['REMEDIATING', 'ESCALATED'],
  REMEDIATING: ['VERIFYING', 'ROLLING_BACK'],
  VERIFYING: ['RESOLVED', 'ROLLING_BACK'],
  ROLLING_BACK: ['FAILED', 'ESCALATED'],
  RESOLVED: [],
  FAILED: [],
  ESCALATED: [],
};

export function transition(from: IncidentStatus, to: IncidentStatus): IncidentStatus {
  if (!EDGES[from].includes(to)) throw new Error(`illegal transition ${from} -> ${to}`);
  return to;
}

export interface Incident {
  id: string;
  orgId: string;
  projectId: string;
  environment: string;
  service: string;
  status: IncidentStatus;
  severity: 'info' | 'warning' | 'critical';
  timeline: { at: number; status: IncidentStatus; note: string }[];
  alertIds: string[];
  postmortem?: string;
}

export function openIncident(input: Omit<Incident, 'status' | 'timeline'> & { at: number }): Incident {
  return {
    ...input,
    status: 'DETECTED',
    timeline: [{ at: input.at, status: 'DETECTED', note: 'correlated alerts' }],
  };
}

export function advance(incident: Incident, to: IncidentStatus, at: number, note: string): Incident {
  const status = transition(incident.status, to);
  const next: Incident = { ...incident, status, timeline: [...incident.timeline, { at, status, note }] };
  if (status === 'RESOLVED') {
    next.postmortem = `Incident ${incident.id} on ${incident.service} resolved. ${note}`;
  }
  return next;
}
