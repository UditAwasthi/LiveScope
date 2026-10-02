import { randomUUID } from 'node:crypto';
import { DEFAULT_SCOPE, type LiveScopeEvent, type VectorClock } from '@livescope/event-schemas';
import { tick } from '@livescope/vector-clock';

export interface Transport {
  send(events: LiveScopeEvent[]): Promise<void>;
}

export interface SpanHandle {
  tag(key: string, value: string): SpanHandle;
  end(): void;
}

export class LiveScopeClient {
  private buffer: LiveScopeEvent[] = [];
  private clock: VectorClock = {};
  private timer: NodeJS.Timeout | undefined;
  constructor(
    private readonly options: {
      nodeId: string;
      transport: Transport;
      flushMs?: number;
      flushCount?: number;
      orgId?: string;
      projectId?: string;
      environment?: string;
      region?: string;
      service?: string;
    },
  ) {}

  metric(name: string, value: number, tags: Record<string, string> = {}): void {
    this.enqueue('METRIC_RECORDED', { metricName: name, value, tags });
  }

  log(level: string, message: string, meta: Record<string, string> = {}): void {
    this.enqueue('LOG_EMITTED', { level, message, context: meta });
  }

  trace(name: string): SpanHandle {
    const spanId = randomUUID();
    const traceId = randomUUID();
    const started = Date.now();
    const tags: Record<string, string> = {};
    const handle: SpanHandle = {
      tag: (key, value) => {
        tags[key] = value;
        return handle;
      },
      end: () => {
        this.enqueue('SPAN_ENDED', {
          operationName: name,
          durationMs: Date.now() - started,
          traceId,
          spanId,
          parentSpanId: '',
          tags: { ...tags },
        });
      },
    };
    return handle;
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.buffer.length === 0) return;
    this.clock = tick(this.clock, this.options.nodeId);
    const batch = this.buffer.map((event) => ({ ...event, vectorClock: { ...this.clock } }));
    this.buffer = [];
    await this.options.transport.send(batch);
  }

  async close(): Promise<void> {
    await this.flush();
  }

  private enqueue(type: LiveScopeEvent['type'], payload: LiveScopeEvent['payload']): void {
    const event = {
      id: randomUUID(),
      type,
      entity: 'service',
      entityId: this.options.service ?? 'app',
      timestamp: Date.now(),
      vectorClock: {},
      orgId: this.options.orgId ?? DEFAULT_SCOPE.orgId,
      projectId: this.options.projectId ?? DEFAULT_SCOPE.projectId,
      environment: this.options.environment ?? DEFAULT_SCOPE.environment,
      region: this.options.region ?? DEFAULT_SCOPE.region,
      payload,
    } as LiveScopeEvent;
    this.buffer.push(event);
    const limit = this.options.flushCount ?? 100;
    if (this.buffer.length >= limit) {
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => {
        void this.flush();
      }, this.options.flushMs ?? 500);
    }
  }
}

export function httpTransport(url: string): Transport {
  return {
    async send(events: LiveScopeEvent[]) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events }),
      });
      if (!response.ok) throw new Error(`ingest failed: ${response.status}`);
    },
  };
}

/** Retries a flush with exponential backoff delays, in milliseconds. */
export function reconnectingTransport(inner: Transport, delays = [50, 100, 200, 400]): Transport {
  return {
    async send(events: LiveScopeEvent[]) {
      let last: unknown;
      for (let attempt = 0; attempt <= delays.length; attempt += 1) {
        try {
          await inner.send(events);
          return;
        } catch (error) {
          last = error;
          const wait = delays[attempt];
          if (wait === undefined) break;
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }
      throw last;
    },
  };
}

/** Emits to the gateway when `LIVESCOPE_GATEWAY_URL` is set. Otherwise the process stays quiet. */
export function dogfoodClient(service: string): LiveScopeClient | undefined {
  const url = process.env.LIVESCOPE_GATEWAY_URL;
  if (!url) return undefined;
  return new LiveScopeClient({
    nodeId: service,
    service,
    transport: reconnectingTransport(httpTransport(url)),
  });
}
