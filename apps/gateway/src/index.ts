import { Kafka, Partitioners } from 'kafkajs';
import { InMemorySchemaRegistry, registerAllSchemas, type LiveScopeEvent } from '@livescope/event-schemas';
import { dogfoodClient } from '@livescope/sdk';
import { CircuitBreaker } from '@livescope/utils';
import { GATEWAY_CLIENT_ID, startGateway } from './server';
import type { EventProducer } from './ingest';

export { GATEWAY_CLIENT_ID, startGateway };
export { ingest, otlpJsonToEvents } from './ingest';

export function createKafkaProducer(brokers: string[]): EventProducer {
  const kafka = new Kafka({ clientId: GATEWAY_CLIENT_ID, brokers });
  const producer = kafka.producer({
    idempotent: true,
    createPartitioner: Partitioners.DefaultPartitioner,
  });
  return {
    async send(record) {
      await producer.connect();
      await producer.send({
        topic: record.topic,
        messages: [{ key: record.key, value: record.value }],
      });
    },
  };
}

async function main(): Promise<void> {
  const registry = new InMemorySchemaRegistry();
  const schemaIds = await registerAllSchemas(registry);
  const metricId = schemaIds['metric-recorded.avsc'] ?? 1;
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  await startGateway({
    producer: createKafkaProducer(brokers),
    breaker: new CircuitBreaker({ failureThreshold: 3, resetMs: 10_000 }),
    encode: (event: LiveScopeEvent) => registry.encode(metricId, event),
  });
  void dogfoodClient('gateway')?.log('info', 'gateway started');
  console.log('gateway listening on :8080 and grpc :50051');
}

const invokedDirectly =
  process.env.VITEST !== 'true' && typeof require !== 'undefined' && require.main === module;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
