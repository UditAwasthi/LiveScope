declare module 'pg' {
  export class Client {
    constructor(config: { connectionString: string });
    connect(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<unknown>;
  }
}
