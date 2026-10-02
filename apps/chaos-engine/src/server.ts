import { createServer } from 'node:http';
import type { ChaosEngine, FaultKind } from './faults';

const KINDS = new Set<FaultKind>(['dropPercent', 'delayMs', 'killNode', 'redisDown']);

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function startChaosApi(engine: ChaosEngine, port = 0): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200);
        res.end('ok');
        return;
      }
      if (req.method === 'GET' && req.url === '/faults') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ faults: engine.active(Date.now()), log: engine.log }));
        return;
      }
      if (req.method === 'POST' && req.url === '/faults') {
        const body = JSON.parse(await readBody(req)) as { kind?: FaultKind; magnitude?: number; ttlMs?: number };
        if (!body.kind || !KINDS.has(body.kind)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'unknown fault' }));
          return;
        }
        engine.inject(body.kind, body.magnitude ?? 0, body.ttlMs ?? 30_000, Date.now());
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ accepted: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    })().catch(() => {
      res.writeHead(400);
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      const address = server.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : 0,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
