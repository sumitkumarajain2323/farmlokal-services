import { createClient, RedisClientType } from 'redis';
import { logger } from '@/utils/logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
}

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

class RedisConnection {
  private client: RedisClientType | null = null;

  async initialize(): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
        password: redisConfig.password,
        database: redisConfig.db,
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('end', () => {
        logger.info('Redis client disconnected');
      });

      await this.client.connect();
      logger.info('Redis connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis connection:', error);
      throw error;
    }
  }

  getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis connection closed');
    }
  }
}

export const redis = new RedisConnection();