export { MemoryStateBus, connectRedisBus, encodeRedisCommand, FANOUT_CHANNEL } from './bus';
export type { StateBus } from './bus';
export { withRetry } from './retry';
export { CircuitBreaker, UnavailableError } from './circuit-breaker';
export type { BreakerState } from './circuit-breaker';
export { healthCheck } from './health';
export { signJwt, verifyJwt } from './jwt';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(
  name: string,
  options?: { level?: LogLevel; sink?: (line: string) => void },
): Logger {
  const minimum = options?.level ?? 'info';
  const sink = options?.sink ?? ((line: string) => console.log(line));

  const write = (level: LogLevel, msg: string, fields?: Record<string, unknown>): void => {
    if (RANK[level] < RANK[minimum]) return;
    sink(
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        name,
        msg,
        ...fields,
      }),
    );
  };

  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
  };
}
