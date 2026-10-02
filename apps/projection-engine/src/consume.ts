import { Kafka } from 'kafkajs';
import type { ProjectionEngine } from './engine';
import { eventFromKafkaValue } from './store';

const TOPICS = ['metrics.raw', 'logs.raw', 'traces.raw', 'alerts.raw'];

export async function consumeKafka(brokers: string[], engine: ProjectionEngine): Promise<void> {
  const kafka = new Kafka({ clientId: 'projection-engine', brokers });
  const consumer = kafka.consumer({ groupId: 'projection-engine' });
  await consumer.connect();
  await consumer.subscribe({ topics: TOPICS, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = eventFromKafkaValue(message.value);
      if (event) engine.ingest(event);
    },
  });
}
