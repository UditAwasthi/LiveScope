import { describe, expect, it } from 'vitest';
import { signJwt } from '@livescope/utils';
import { startRealtimeGateway } from './server';

function once(socket: WebSocket, event: 'open' | 'message'): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 3000);
    socket.addEventListener(event, (message) => {
      clearTimeout(timer);
      resolve(event === 'message' ? String((message as MessageEvent).data) : '');
    });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('socket error'));
    });
  });
}

describe('realtime gateway', () => {
  it('rejects an anonymous socket and delivers a subscribed patch after a snapshot', async () => {
    const gateway = await startRealtimeGateway({ secret: 'secret' });
    const anonymous = new WebSocket(`ws://127.0.0.1:${gateway.port}/`);
    await expect(once(anonymous, 'open')).rejects.toThrow();

    const token = signJwt({ sub: 'ada' }, 'secret', 60);
    const socket = new WebSocket(`ws://127.0.0.1:${gateway.port}/?token=${token}`);
    await once(socket, 'open');
    const snapshot = once(socket, 'message');
    socket.send(JSON.stringify({ op: 'subscribe', entity: 'api', filter: 'latency < 200' }));
    expect(JSON.parse(await snapshot)).toMatchObject({ type: 'SNAPSHOT', entity: 'api' });
    const patch = once(socket, 'message');
    gateway.publish({ type: 'PATCH', entity: 'service', id: 'api', changes: { latency: 10 } });
    expect(JSON.parse(await patch)).toMatchObject({ id: 'api', changes: { latency: 10 } });
    socket.close();
    await gateway.close();
  });
});
