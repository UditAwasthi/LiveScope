const { LiveScopeClient } = require('../packages/sdk/dist/index.js');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

async function main() {
  const services = Number(arg('services', '3'));
  const events = Number(arg('events', '100'));
  const interval = Number(arg('interval', '0'));
  const sent = [];
  const gateway = process.env.GATEWAY_URL;
  const client = new LiveScopeClient({
    nodeId: 'seed',
    service: 'seed',
    flushCount: 50,
    flushMs: 200,
    transport: {
      async send(batch) {
        sent.push(...batch);
        if (!gateway) return;
        const response = await fetch(gateway, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ events: batch }),
        });
        if (!response.ok) throw new Error(`gateway ${response.status}`);
      },
    },
  });

  for (let i = 0; i < events; i += 1) {
    const service = `svc-${i % services}`;
    client.metric('latency', 20 + Math.random() * 30, { service });
    client.metric('error_rate', Math.random() * 0.05, { service });
    client.metric('rps', 50 + Math.random() * 20, { service });
    if (i % 10 === 0) client.log('info', 'heartbeat', { service });
    if (interval > 0) await new Promise((resolve) => setTimeout(resolve, interval));
  }
  await client.close();
  console.log(`seeded ${sent.length} events across ${services} services`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
