import { createHmac, timingSafeEqual } from 'node:crypto';

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

export function signJwt(payload: Record<string, unknown>, secret: string, ttlSec: number): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): Record<string, unknown> | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  const [header, body, signature] = parts;
  if (!header || !body || !signature) return undefined;
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return undefined;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
  if (typeof payload.exp === 'number' && payload.exp < nowSec) return undefined;
  return payload;
}
