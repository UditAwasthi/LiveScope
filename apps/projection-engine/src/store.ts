import type { LiveScopeEvent } from '@livescope/event-schemas';

export const EVENTS_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS events (
    offset_id bigint PRIMARY KEY,
    entity_id text NOT NULL,
    event_timestamp bigint NOT NULL,
    payload jsonb NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS events_entity_time ON events (entity_id, event_timestamp)`,
];

export function insertEvent(event: LiveScopeEvent, offset: number): { sql: string; params: unknown[] } {
  return {
    sql: 'INSERT INTO events (offset_id, entity_id, event_timestamp, payload) VALUES ($1, $2, $3, $4::jsonb)',
    params: [offset, event.entityId, event.timestamp, JSON.stringify(event)],
  };
}

interface PgClient {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

export async function postgresSink(connectionString: string): Promise<(event: LiveScopeEvent, offset: number) => void> {
  const pg = (await import('pg')) as unknown as {
    Client: new (config: { connectionString: string }) => PgClient;
  };
  const client = new pg.Client({ connectionString });
  await client.connect();
  for (const statement of EVENTS_STATEMENTS) await client.query(statement);
  return (event, offset) => {
    const statement = insertEvent(event, offset);
    void client.query(statement.sql, statement.params);
  };
}

export function eventFromKafkaValue(value: Buffer): LiveScopeEvent | undefined {
  const parsed = JSON.parse(value.toString()) as { event?: LiveScopeEvent } | LiveScopeEvent;
  if (!parsed || typeof parsed !== 'object') return undefined;
  if ('event' in parsed && parsed.event && typeof parsed.event === 'object' && 'type' in parsed.event) return parsed.event;
  if ('type' in parsed) return parsed;
  return undefined;
}
