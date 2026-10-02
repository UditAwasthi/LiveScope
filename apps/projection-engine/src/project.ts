import { PNCounter, LWWRegister } from '@livescope/crdt';
import { compare, merge, type VectorClock } from '@livescope/vector-clock';
import type { LiveScopeEvent } from '@livescope/event-schemas';

export interface ServiceState {
  entityId: string;
  orgId: string;
  projectId: string;
  environment: string;
  region: string;
  vectorClock: VectorClock;
  status: string;
  version: string;
  metrics: Record<string, number>;
  errorCount: { increments: Record<string, number>; decrements: Record<string, number> };
  updatedAt: number;
}

export function emptyService(event: LiveScopeEvent): ServiceState {
  return {
    entityId: event.entityId,
    orgId: event.orgId,
    projectId: event.projectId,
    environment: event.environment,
    region: event.region,
    vectorClock: {},
    status: 'unknown',
    version: 'unknown',
    metrics: {},
    errorCount: { increments: {}, decrements: {} },
    updatedAt: 0,
  };
}

export function applyEvent(state: ServiceState, event: LiveScopeEvent): { state: ServiceState; dropped: boolean } {
  const order = compare(event.vectorClock, state.vectorClock);
  if (state.updatedAt !== 0 && (order === 'BEFORE' || order === 'EQUAL')) return { state, dropped: true };
  const next: ServiceState = {
    ...state,
    vectorClock: merge(state.vectorClock, event.vectorClock),
    metrics: { ...state.metrics },
    updatedAt: event.timestamp,
    region: event.region,
  };
  if (event.type === 'METRIC_RECORDED') {
    next.metrics[event.payload.metricName] = event.payload.value;
    if (event.payload.tags.version) next.version = event.payload.tags.version;
    if (event.payload.tags.status) {
      next.status = LWWRegister.of(event.payload.tags.status, event.timestamp, event.entityId).get()?.value ?? next.status;
    }
    if (event.payload.metricName.includes('error')) {
      const counter = PNCounter.fromJSON(state.errorCount).increment(event.region || 'local', 1);
      next.errorCount = counter.toJSON();
    }
  }
  return { state: next, dropped: false };
}
