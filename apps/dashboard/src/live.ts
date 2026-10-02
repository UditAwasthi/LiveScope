import { useDashboard, type ServiceCard } from './store';

export type LiveMessage =
  | { type: 'SNAPSHOT'; cards: ServiceCard[] }
  | { type: 'PATCH'; id: string; changes: Record<string, number | string> }
  | { type: 'ALERT'; id: string; message: string };

export function historicalPath(entityId: string, at: number): string {
  return `/state?entityId=${encodeURIComponent(entityId)}&at=${at}`;
}

export function applyLiveMessage(message: LiveMessage): void {
  const state = useDashboard.getState();
  if (message.type === 'SNAPSHOT') state.snapshot(message.cards);
  if (message.type === 'PATCH') state.applyPatch(message.id, message.changes);
  if (message.type === 'ALERT') state.pushAlert(message.id, message.message);
}

export async function pullState(
  fetcher: (path: string) => Promise<ServiceCard | null>,
  entityId: string,
  at: number,
): Promise<ServiceCard | null> {
  return fetcher(historicalPath(entityId, at));
}
