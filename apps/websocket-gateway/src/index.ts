import { dogfoodClient } from '@livescope/sdk';
import { connectRedisBus } from '@livescope/utils';
import { startRealtimeGateway } from './server';

export const SERVICE = 'websocket-gateway';
export const VERSION = '1.0.0';
export { accept, authorize } from './protocol';
export { startRealtimeGateway } from './server';

async function main(): Promise<void> {
  const bus = process.env.REDIS_URL ? await connectRedisBus(process.env.REDIS_URL) : undefined;
  const gateway = await startRealtimeGateway({
    secret: process.env.JWT_SECRET ?? 'dev-secret',
    port: Number(process.env.PORT ?? 8084),
    bus,
  });
  void dogfoodClient(SERVICE)?.log('info', 'websocket started');
  console.log(`websocket listening on :${gateway.port}`);
}

const invokedDirectly = process.env.VITEST !== 'true' && require.main === module;
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
