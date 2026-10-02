import { dogfoodClient } from '@livescope/sdk';
import { connectRedisBus, MemoryStateBus } from '@livescope/utils';
import { bindStateBus } from './bind';
import { StreamEngine } from './engine';
import { startStreamApi } from './server';

export const SERVICE = 'stream-engine';
export const VERSION = '1.0.0';
export { StreamEngine } from './engine';
export { bindStateBus, prometheusText } from './bind';

async function main(): Promise<void> {
  const engine = new StreamEngine();
  const bus = process.env.REDIS_URL ? await connectRedisBus(process.env.REDIS_URL) : new MemoryStateBus();
  bindStateBus(bus, engine, 'dashboard');
  const port = Number(process.env.PORT ?? 8083);
  await startStreamApi(engine, port);
  void dogfoodClient(SERVICE)?.log('info', 'stream started');
  console.log(`stream listening on :${port}`);
}

const invokedDirectly = process.env.VITEST !== 'true' && require.main === module;
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
