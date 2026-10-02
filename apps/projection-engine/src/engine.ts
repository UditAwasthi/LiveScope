import type { LiveScopeEvent } from '@livescope/event-schemas';
import { scopeKey } from '@livescope/event-schemas';
import { applyEvent, emptyService, type ServiceState } from './project';

export interface StatePublisher {
  publish(channel: string, payload: string): void;
}

export interface StoredEvent {
  event: LiveScopeEvent;
  offset: number;
}

export interface ProjectionSnapshot {
  services: Record<string, ServiceState>;
  offset: number;
  takenAt: number;
}

export class ProjectionLog {
  readonly events: StoredEvent[] = [];
  private snapshot: ProjectionSnapshot | undefined;
  private offset = 0;

  constructor(private readonly sink?: (event: LiveScopeEvent, offset: number) => void) {}

  append(event: LiveScopeEvent): number {
    this.offset += 1;
    this.events.push({ event, offset: this.offset });
    this.sink?.(event, this.offset);
    return this.offset;
  }

  saveSnapshot(services: Record<string, ServiceState>, every = 1000): void {
    if (this.offset === 0 || this.offset % every !== 0) return;
    this.snapshot = { services: structuredClone(services), offset: this.offset, takenAt: Date.now() };
  }

  forceSnapshot(services: Record<string, ServiceState>): void {
    this.snapshot = { services: structuredClone(services), offset: this.offset, takenAt: Date.now() };
  }

  load(): { services: Record<string, ServiceState>; replay: StoredEvent[] } {
    if (!this.snapshot) return { services: {}, replay: [...this.events] };
    return {
      services: structuredClone(this.snapshot.services),
      replay: this.events.filter((item) => item.offset > this.snapshot!.offset),
    };
  }

  eventsUntil(entityId: string, at: number): LiveScopeEvent[] {
    return this.events
      .map((item) => item.event)
      .filter((event) => event.entityId === entityId && event.timestamp <= at);
  }
}

export class ProjectionEngine {
  private services: Record<string, ServiceState> = {};

  constructor(
    private readonly log = new ProjectionLog(),
    private readonly bus?: StatePublisher,
  ) {}

  ingest(event: LiveScopeEvent): { dropped: boolean } {
    const key = scopeKey(event, event.entityId);
    const current = this.services[key] ?? emptyService(event);
    const applied = applyEvent(current, event);
    if (!applied.dropped) {
      this.services[key] = applied.state;
      const lane = event.type === 'ALERT_RAISED' || event.type === 'ALERT_RESOLVED' ? 'HIGH' : 'NORMAL';
      this.bus?.publish('state', JSON.stringify({ lane, state: applied.state }));
    }
    this.log.append(event);
    this.log.saveSnapshot(this.services);
    return { dropped: applied.dropped };
  }

  crashAndRecover(): void {
    const restored = this.log.load();
    this.services = restored.services;
    for (const item of restored.replay) {
      const key = scopeKey(item.event, item.event.entityId);
      const current = this.services[key] ?? emptyService(item.event);
      const applied = applyEvent(current, item.event);
      if (!applied.dropped) this.services[key] = applied.state;
    }
  }

  get(scope: { orgId: string; projectId: string; environment: string }, entityId: string): ServiceState | undefined {
    return this.services[scopeKey(scope, entityId)];
  }

  at(scope: { orgId: string; projectId: string; environment: string }, entityId: string, timestamp: number): ServiceState | undefined {
    const events = this.log.eventsUntil(entityId, timestamp).filter(
      (event) => event.orgId === scope.orgId && event.projectId === scope.projectId && event.environment === scope.environment,
    );
    if (events.length === 0) return undefined;
    let state = emptyService(events[0]!);
    for (const event of events) {
      const applied = applyEvent(state, event);
      if (!applied.dropped) state = applied.state;
    }
    return state;
  }

  catalog(scope: { orgId: string; projectId: string; environment: string }): ServiceState[] {
    return Object.values(this.services).filter(
      (service) => service.orgId === scope.orgId && service.projectId === scope.projectId && service.environment === scope.environment,
    );
  }

  snapshotNow(): void {
    this.log.forceSnapshot(this.services);
  }
}
