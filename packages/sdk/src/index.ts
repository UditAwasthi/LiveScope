export const VERSION = '1.0.0';
export { LiveScopeClient, dogfoodClient, httpTransport, reconnectingTransport } from './client';
export type { Transport, SpanHandle } from './client';
export { grpcTransport } from './grpc';
