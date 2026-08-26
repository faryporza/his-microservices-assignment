declare module 'pg' {
  interface PoolOptions {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }

  export class Pool {
    constructor(options: PoolOptions);
    query(text: string, values: readonly unknown[]): Promise<unknown>;
    end(): Promise<void>;
  }
}
