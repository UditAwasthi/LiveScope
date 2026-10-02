import { dogfoodClient } from '@livescope/sdk';
import { startRegionApi } from './server';

export const SERVICE = 'region-simulator';
export const VERSION = '1.0.0';
export { concurrentCount, deliver } from './partition';
export { startRegionApi } from './server';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 8086);
  await startRegionApi(port);
  void dogfoodClient(SERVICE)?.log('info', 'region started');
  console.log(`region listening on :${port}`);
}

const invokedDirectly = process.env.VITEST !== 'true' && require.main === module;
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
