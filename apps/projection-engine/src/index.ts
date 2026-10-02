import { createServer } from 'node:http';
import { dogfoodClient } from '@livescope/sdk';
import { connectRedisBus, MemoryStateBus, type StateBus } from '@livescope/utils';
import { consumeKafka } from './consume';
import { ProjectionEngine, ProjectionLog } from './engine';
import { postgresSink } from './store';

export const SERVICE = 'projection-engine';
export const VERSION = '1.0.0';
export { ProjectionEngine, ProjectionLog } from './engine';
export { applyEvent } from './project';
export { eventFromKafkaValue, insertEvent } from './store';

export function startProjectionApi(engine: ProjectionEngine, port = 8082): Promise<void> {
  const scope = { orgId: 'local', projectId: 'default', environment: 'dev' };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/healthz') {
      res.writeHead(200);
      res.end('ok');
      return;
    }
    if (url.pathname === '/state') {
      const entityId = url.searchParams.get('entityId') ?? '';
      const at = url.searchParams.get('at');
      const state = at ? engine.at(scope, entityId, Number(at)) : engine.get(scope, entityId);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(state ?? null));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => server.listen(port, resolve));
}

async function main(): Promise<void> {
  let bus: StateBus = new MemoryStateBus();
  if (process.env.REDIS_URL) bus = await connectRedisBus(process.env.REDIS_URL);
  const sink = process.env.DATABASE_URL ? await postgresSink(process.env.DATABASE_URL) : undefined;
  const engine = new ProjectionEngine(new ProjectionLog(sink), bus);
  if (process.env.KAFKA_BROKERS) {
    void consumeKafka(process.env.KAFKA_BROKERS.split(','), engine).catch((error: unknown) => {
      console.error(error);
    });
  }
  const port = Number(process.env.PORT ?? 8082);
  await startProjectionApi(engine, port);
  void dogfoodClient(SERVICE)?.log('info', 'projection started');
  console.log(`projection listening on :${port}`);
}

const invokedDirectly = process.env.VITEST !== 'true' && require.main === module;
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
