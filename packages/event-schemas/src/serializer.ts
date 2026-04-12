import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import type { LiveScopeEvent } from './types';

const registry = new SchemaRegistry({
  host: 'http://localhost:8081',
});

const metricSchemaPath = path.resolve(__dirname, '../avro/metric-recorded.avsc');

export class AvroSerializer {
  static async registerMetricSchema(): Promise<number> {
    const schema = readFileSync(metricSchemaPath, 'utf-8');

    const result = await registry.register({
      type: SchemaType.AVRO,
      schema,
    });

    return result.id;
  }

  static async encodeMetricEvent(schemaId: number, event: LiveScopeEvent): Promise<Buffer> {
    return registry.encode(schemaId, event);
  }
}

export class AvroDeserializer {
  static async decode(buffer: Buffer): Promise<unknown> {
    return registry.decode(buffer);
  }
}