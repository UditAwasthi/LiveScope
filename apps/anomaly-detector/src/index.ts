import { dogfoodClient } from '@livescope/sdk';
import { startAnomalyApi } from './server';

export const SERVICE = 'anomaly-detector';
export const VERSION = '1.0.0';
export { AnomalyDetector } from './ewma';
export { alertFromSignal } from './alerts';
export { startAnomalyApi } from './server';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 8085);
  await startAnomalyApi(undefined, port);
  void dogfoodClient(SERVICE)?.log('info', 'anomaly started');
  console.log(`anomaly listening on :${port}`);
}

const invokedDirectly = process.env.VITEST !== 'true' && require.main === module;
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
