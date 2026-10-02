import { evaluate, parseFilter } from '@livescope/query-engine';
import { verifyJwt } from '@livescope/utils';
import type { DiffEvent } from '@livescope/event-schemas';

export interface Subscription {
  entity: string;
  filter?: string;
  fields?: string[];
}

export function authorize(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const payload = verifyJwt(token, secret);
  return Boolean(payload && typeof payload.sub === 'string');
}

export function accept(event: DiffEvent, subscription: Subscription): boolean {
  if (subscription.entity !== '*' && subscription.entity !== event.id) return false;
  if (!subscription.filter) return true;
  const context: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.changes)) {
    if (typeof value === 'number' || typeof value === 'string') context[key] = value;
    if (value && typeof value === 'object') {
      for (const [nested, inner] of Object.entries(value as Record<string, unknown>)) {
        if (typeof inner === 'number' || typeof inner === 'string') context[nested] = inner;
      }
    }
  }
  return evaluate(parseFilter(subscription.filter), context);
}
