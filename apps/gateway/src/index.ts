import { Kafka } from 'kafkajs';
import {
    AvroSerializer,
    KafkaTopic,
    type LiveScopeEvent,
} from '@livescope/event-schemas';

const kafka = new Kafka({
    clientId: 'livescope-gateway',
    brokers: ['localhost:9092'],
});

const producer = kafka.producer();

async function main() {
    await producer.connect();

    // Register schema
    const schemaId = await AvroSerializer.registerMetricSchema();
    // Create event
    const event: LiveScopeEvent = {
        id: 'evt-2',
        type: 'METRIC_RECORDED',
        entity: 'service',
        entityId: 'gateway',
        timestamp: Date.now(),
        vectorClock: {
            'node-1': 1,
        },
        payload: {
            metricName: 'gateway.requests',
            value: Math.random() * 100,
            tags: {
                route: '/test',
                method: 'GET',
            },
        },
    };

    //  Encode
    const encoded = await AvroSerializer.encodeMetricEvent(schemaId, event);

    //  Send to Kafka
    await producer.send({
        topic: KafkaTopic.METRICS_RAW,
        messages: [
            {
                value: encoded,
            },
        ],
    });

    console.log('Event sent to Kafka');

    await producer.disconnect();
}

main().catch(console.error);