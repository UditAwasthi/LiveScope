import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { LiveScopeEvent } from '@livescope/event-schemas';
import type { Transport } from './client';

interface StreamCall {
  write(envelope: Record<string, unknown>): void;
  end(): void;
}

interface IngestClient extends grpc.Client {
  batchEvents(callback: (error: grpc.ServiceError | null, ack: { accepted?: boolean }) => void): StreamCall;
}

function loadClient(address: string): IngestClient {
  const definition = protoLoader.loadSync(path.resolve(__dirname, '../proto/livescope.proto'), {
    keepCase: true,
    longs: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(definition) as unknown as {
    livescope: { v1: { Ingest: new (address: string, credentials: grpc.ChannelCredentials) => IngestClient } };
  };
  return new loaded.livescope.v1.Ingest(address, grpc.credentials.createInsecure());
}

function envelope(event: LiveScopeEvent): Record<string, unknown> {
  return {
    id: event.id,
    type: event.type,
    entity: event.entity,
    entity_id: event.entityId,
    timestamp: event.timestamp,
    vector_clock: event.vectorClock,
    payload_json: JSON.stringify(event.payload),
    org_id: event.orgId,
    project_id: event.projectId,
    environment: event.environment,
    region: event.region,
  };
}

/** gRPC client transport. Opens a stream per flush and closes it when the ack arrives. */
export function grpcTransport(address: string): Transport {
  return {
    async send(events: LiveScopeEvent[]) {
      const client = loadClient(address);
      try {
        await new Promise<void>((resolve, reject) => {
          const call = client.batchEvents((error) => {
            if (error) reject(error);
            else resolve();
          });
          for (const event of events) call.write(envelope(event));
          call.end();
        });
      } finally {
        client.close();
      }
    },
  };
}
