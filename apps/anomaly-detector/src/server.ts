import { createServer } from 'node:http';
import { alertFromSignal } from './alerts';
import { AnomalyDetector } from './ewma';

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function startAnomalyApi(detector = new AnomalyDetector(), port = 0): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/healthz') {
        res.writeHead(200);
        res.end('ok');
        return;
      }
      if (req.method === 'POST' && req.url === '/sample') {
        const body = JSON.parse(await readBody(req)) as { key?: string; value?: number; entityId?: string };
        const signal = detector.update(body.key ?? 'metric', body.value ?? 0);
        const alert = alertFromSignal(signal, body.entityId ?? 'api', body.key ?? 'metric', body.value ?? 0, Date.now());
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ signal, alert: alert ?? null }));
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
