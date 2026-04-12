import { AvroSerializer, AvroDeserializer } from './serializer';
import type { LiveScopeEvent } from './types';

async function main() {
  const schemaId = 1;
  const event: LiveScopeEvent = {
    id: 'evt-1',
    type: 'METRIC_RECORDED',
    entity: 'service',
    entityId: 'api-gateway',
    timestamp: Date.now(),
    vectorClock: {
      'node-1': 1,
    },
    payload: {
      metricName: 'request.latency',
      value: 123.45,
      tags: {
        route: '/users',
        method: 'GET',
      },
    },
  };

  const encoded = await AvroSerializer.encodeMetricEvent(schemaId, event);
  const decoded = await AvroDeserializer.decode(encoded);

  console.log('Schema ID:', schemaId);
  console.log('Decoded event:', decoded);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});