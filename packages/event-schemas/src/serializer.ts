import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import type { LiveScopeEvent } from './types';

export interface SchemaRegistrar {
  register(schema: string): Promise<number> | number;
  encode?(schemaId: number, event: LiveScopeEvent): Promise<Buffer> | Buffer;
}

const schemaDir = path.resolve(__dirname, '../avro');

export function listSchemaFiles(): string[] {
  return readdirSync(schemaDir)
    .filter((name) => name.endsWith('.avsc'))
    .sort()
    .map((name) => path.join(schemaDir, name));
}

export function readSchema(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

/** Same schema text always returns the same id. */
export class InMemorySchemaRegistry implements SchemaRegistrar {
  private readonly ids = new Map<string, number>();
  private next = 1;

  register(schema: string): number {
    const existing = this.ids.get(schema);
    if (existing !== undefined) return existing;
    const id = this.next;
    this.next += 1;
    this.ids.set(schema, id);
    return id;
  }

  encode(schemaId: number, event: LiveScopeEvent): Buffer {
    return Buffer.from(JSON.stringify({ schemaId, event }));
  }
}

let remote: SchemaRegistry | undefined;

function remoteRegistry(): SchemaRegistry {
  remote ??= new SchemaRegistry({
    host: process.env.SCHEMA_REGISTRY_URL ?? 'http://localhost:8081',
  });
  return remote;
}

export async function registerAllSchemas(registry: SchemaRegistrar = {
  async register(schema: string) {
    const result = await remoteRegistry().register({ type: SchemaType.AVRO, schema });
    return result.id;
  },
}): Promise<Record<string, number>> {
  const ids: Record<string, number> = {};
  for (const filePath of listSchemaFiles()) {
    const schema = readSchema(filePath);
    ids[path.basename(filePath)] = await registry.register(schema);
  }
  return ids;
}

export class AvroSerializer {
  static registerMetricSchema(): Promise<number> {
    return registerAllSchemas().then((ids) => {
      const id = ids['metric-recorded.avsc'];
      if (id === undefined) throw new Error('metric schema missing');
      return id;
    });
  }

  static async encodeMetricEvent(schemaId: number, event: LiveScopeEvent): Promise<Buffer> {
    return remoteRegistry().encode(schemaId, event);
  }

  static async encodeEvent(schemaId: number, event: LiveScopeEvent): Promise<Buffer> {
    return remoteRegistry().encode(schemaId, event);
  }
}

export class AvroDeserializer {
  static async decode(buffer: Buffer): Promise<unknown> {
    return remoteRegistry().decode(buffer);
  }
}
