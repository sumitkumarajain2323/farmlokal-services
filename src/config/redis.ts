import { createClient, RedisClientType } from 'redis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),
};

class RedisConnection {
  private client: RedisClientType | null = null;
  private connecting = false;
  private connectionPromise: Promise<RedisClientType> | null = null;

  private async connect(): Promise<RedisClientType> {
    if (this.client) return this.client;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.doConnect();
    return this.connectionPromise;
  }

  private async doConnect(): Promise<RedisClientType> {
    try {
      this.connecting = true;

      this.client = createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
          reconnectStrategy: retries => Math.min(retries * 50, 1000),
        },
        password: redisConfig.password,
        database: redisConfig.db,
      });

      this.client.on('error', err => {
        console.warn('Redis error (continuing without Redis):', err.message);
      });

      this.client.on('connect', () => {
        console.log('Redis connected successfully');
      });

      this.client.on('disconnect', () => {
        console.warn('Redis disconnected');
        this.client = null;
        this.connectionPromise = null;
      });

      await this.client.connect();
      return this.client;
    } catch (err) {
      this.client = null;
      this.connectionPromise = null;
      throw err;
    } finally {
      this.connecting = false;
    }
  }

  async getClient(): Promise<RedisClientType | null> {
    try {
      return await this.connect();
    } catch (err) {
      console.warn('Redis unavailable, continuing without cache:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (err) {
        console.warn('Error closing Redis connection:', err);
      }
      this.client = null;
      this.connectionPromise = null;
    }
  }
}

export const redis = new RedisConnection();
