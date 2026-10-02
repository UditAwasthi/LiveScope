import { createServer } from 'node:http';
import type { VectorClock } from '@livescope/vector-clock';
import { concurrentCount, deliver, type RegionEvent } from './partition';

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function startRegionApi(port = 0): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200);
        res.end('ok');
        return;
      }
      if (req.method === 'POST' && req.url === '/deliver') {
        const body = JSON.parse(await readBody(req)) as RegionEvent & { localRegion?: string; partitioned?: boolean };
        const decision = deliver(body, body.localRegion ?? body.region, Boolean(body.partitioned));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(decision));
        return;
      }
      if (req.method === 'POST' && req.url === '/divergence') {
        const body = JSON.parse(await readBody(req)) as { clocks?: VectorClock[] };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ concurrent: concurrentCount(body.clocks ?? []) }));
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
