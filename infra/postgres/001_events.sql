CREATE TABLE IF NOT EXISTS events (
  offset_id bigint PRIMARY KEY,
  entity_id text NOT NULL,
  event_timestamp bigint NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS events_entity_time ON events (entity_id, event_timestamp);
