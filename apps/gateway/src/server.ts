import { createServer, type Server as HttpServer } from 'node:http';
import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { healthCheck } from '@livescope/utils';
import { ingest, otlpJsonToEvents, type IngestDeps } from './ingest';

export const GATEWAY_CLIENT_ID = 'livescope-gateway';

export interface GatewayServers {
  http: HttpServer;
  grpc: grpc.Server;
  grpcPort: number;
  close: () => Promise<void>;
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function startGateway(deps: IngestDeps, options?: { httpPort?: number; grpcPort?: number }): Promise<GatewayServers> {
  const http = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/healthz') {
        const report = await healthCheck({ gateway: async () => true });
        res.writeHead(report.ok ? 200 : 503, { 'content-type': 'application/json' });
        res.end(JSON.stringify(report));
        return;
      }
      if (req.method === 'POST' && (req.url === '/v1/events' || req.url === '/v1/metrics')) {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as { events?: unknown[] };
        const inputs = req.url === '/v1/metrics' ? otlpJsonToEvents(body) : (body.events ?? []);
        const results = [];
        for (const input of inputs) results.push(await ingest(input, deps));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ results }));
        return;
      }
      res.writeHead(404);
      res.end();
    })().catch((error: unknown) => {
      const unavailable = error instanceof Error && error.name === 'UnavailableError';
      res.writeHead(unavailable ? 503 : 400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'error' }));
    });
  });

  await new Promise<void>((resolve) => http.listen(options?.httpPort ?? 8080, resolve));

  const definition = protoLoader.loadSync(path.resolve(__dirname, '../proto/livescope.proto'), {
    keepCase: true,
    longs: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(definition) as unknown as {
    livescope: { v1: { Ingest: { service: grpc.ServiceDefinition } } };
  };
  const grpcServer = new grpc.Server();
  grpcServer.addService(loaded.livescope.v1.Ingest.service, {
    BatchEvents: (call: grpc.ServerReadableStream<Record<string, unknown>, unknown>, callback: grpc.sendUnaryData<unknown>) => {
      const pending: Promise<unknown>[] = [];
      let lastId = '';
      call.on('data', (envelope: Record<string, unknown>) => {
        const read = (snake: string, camel: string) => envelope[snake] ?? envelope[camel];
        const payloadJson = read('payload_json', 'payloadJson');
        let payload: unknown = {};
        if (typeof payloadJson === 'string' && payloadJson.length > 0) payload = JSON.parse(payloadJson);
        const rawClock = read('vector_clock', 'vectorClock');
        const vectorClock: Record<string, number> = {};
        if (rawClock && typeof rawClock === 'object') {
          for (const [key, item] of Object.entries(rawClock as Record<string, unknown>)) {
            const value = typeof item === 'number' ? item : Number(item);
            if (Number.isInteger(value) && value >= 0) vectorClock[key] = value;
          }
        }
        const event = {
          id: read('id', 'id'),
          type: read('type', 'type'),
          entity: read('entity', 'entity'),
          entityId: read('entity_id', 'entityId'),
          timestamp: Number(read('timestamp', 'timestamp')),
          vectorClock,
          orgId: read('org_id', 'orgId'),
          projectId: read('project_id', 'projectId'),
          environment: read('environment', 'environment'),
          region: read('region', 'region'),
          payload,
        };
        lastId = String(envelope.id ?? '');
        pending.push(ingest(event, deps));
      });
      call.on('end', () => {
        void Promise.all(pending)
          .then(() => callback(null, { accepted: true, event_id: lastId }))
          .catch((error: Error) => callback({ code: grpc.status.UNAVAILABLE, message: error.message }));
      });
    },
  });
  const grpcPort = await new Promise<number>((resolve, reject) => {
    grpcServer.bindAsync(`0.0.0.0:${options?.grpcPort ?? 50051}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
      if (error) reject(error);
      else resolve(port);
    });
  });

  return {
    http,
    grpc: grpcServer,
    grpcPort,
    close: () =>
      new Promise((resolve) => {
        grpcServer.tryShutdown(() => {
          http.close(() => resolve());
        });
      }),
  };
}
