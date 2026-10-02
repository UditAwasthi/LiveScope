import { createServer, type IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { FANOUT_CHANNEL, MemoryStateBus, type StateBus } from '@livescope/utils';
import type { DiffEvent } from '@livescope/event-schemas';
import { encodeServerText, tryDecodeClientFrame, websocketAccept } from './frames';
import { accept, authorize, type Subscription } from './protocol';

interface SocketState {
  socket: Duplex;
  subscriptions: Subscription[];
}

export interface RealtimeGateway {
  port: number;
  publish(event: DiffEvent): void;
  close(): Promise<void>;
}

function writeJson(socket: Duplex, body: unknown): void {
  socket.write(encodeServerText(JSON.stringify(body)));
}

export function startRealtimeGateway(options: { secret: string; port?: number; bus?: StateBus }): Promise<RealtimeGateway> {
  const bus = options.bus ?? new MemoryStateBus();
  const sockets = new Set<SocketState>();
  bus.subscribe(FANOUT_CHANNEL, (payload) => {
    const event = JSON.parse(payload) as DiffEvent;
    for (const client of sockets) {
      if (client.subscriptions.some((subscription) => accept(event, subscription))) writeJson(client.socket, event);
    }
  });

  const server = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200);
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, _head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (!authorize(url.searchParams.get('token') ?? undefined, options.secret)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (typeof key !== 'string') {
      socket.destroy();
      return;
    }
    const client: SocketState = { socket, subscriptions: [] };
    sockets.add(client);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${websocketAccept(key)}\r\n\r\n`,
    );
    let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      let decoded = tryDecodeClientFrame(pending);
      while (decoded) {
        pending = decoded.rest;
        if (decoded.opcode === 0x8) {
          sockets.delete(client);
          socket.end();
          return;
        }
        if (decoded.opcode === 0x9) socket.write(Buffer.from([0x8a, 0x00]));
        if (decoded.opcode === 1 && decoded.text.length > 0) {
          try {
            const message = JSON.parse(decoded.text) as { op?: string; entity?: string; filter?: string };
            if (message.op === 'subscribe' && message.entity) {
              client.subscriptions.push({ entity: message.entity, filter: message.filter });
              writeJson(socket, { type: 'SNAPSHOT', entity: message.entity });
            }
            if (message.op === 'unsubscribe' && message.entity) {
              client.subscriptions = client.subscriptions.filter((item) => item.entity !== message.entity);
            }
          } catch {
            writeJson(socket, { type: 'ERROR', message: 'invalid json' });
          }
        }
        decoded = tryDecodeClientFrame(pending);
      }
    });
    socket.on('close', () => sockets.delete(client));
    socket.on('error', () => sockets.delete(client));
  });

  return new Promise((resolve) => {
    server.listen(options.port ?? 0, '0.0.0.0', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        port,
        publish(event) {
          bus.publish(FANOUT_CHANNEL, JSON.stringify(event));
        },
        close: () =>
          new Promise((done) => {
            for (const client of sockets) client.socket.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}
