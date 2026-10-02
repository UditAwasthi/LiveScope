import { dogfoodClient } from '@livescope/sdk';
import { ChaosEngine } from './faults';
import { startChaosApi } from './server';

export const SERVICE = 'chaos-engine';
export const VERSION = '1.0.0';
export { ChaosEngine } from './faults';
export { startChaosApi } from './server';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 8090);
  await startChaosApi(new ChaosEngine(), port);
  void dogfoodClient(SERVICE)?.log('info', 'chaos started');
  console.log(`chaos listening on :${port}`);
}

const invokedDirectly = process.env.VITEST !== 'true' && require.main === module;
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
