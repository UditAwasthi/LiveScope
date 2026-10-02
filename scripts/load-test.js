const { readFileSync } = require('node:fs');
const path = require('node:path');
const { ingest } = require('../apps/gateway/dist/ingest.js');
const { CircuitBreaker } = require('../packages/utils/dist/index.js');

async function main() {
  const records = [];
  const deps = {
    producer: { async send(record) { records.push(record); } },
    breaker: new CircuitBreaker({ failureThreshold: 100, resetMs: 1000 }),
    encode: (event) => Buffer.from(JSON.stringify(event)),
  };
  const started = Date.now();
  let count = 0;
  while (Date.now() - started < 300) {
    await ingest({
      id: `load-${count}`,
      type: 'METRIC_RECORDED',
      entity: 'service',
      entityId: 'load',
      timestamp: Date.now(),
      vectorClock: { load: count + 1 },
      payload: { metricName: 'rps', value: count, tags: {} },
    }, deps);
    count += 1;
  }
  const elapsed = (Date.now() - started) / 1000;
  const rate = count / elapsed;
  const baseline = JSON.parse(readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
  console.log(`ingest ${rate.toFixed(0)} events/sec (baseline ${baseline.eventsPerSecond})`);
  if (rate < baseline.eventsPerSecond * 0.9) {
    console.error('throughput dropped more than 10%');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
