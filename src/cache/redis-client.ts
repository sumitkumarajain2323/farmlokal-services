import { redis } from '../config/redis';
import { RedisClientType } from 'redis';

export class RedisCache {
  constructor(private client: RedisClientType) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      console.warn('Redis get failed:', err);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (ttl) {
        await this.client.set(key, value, { EX: ttl });
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (err) {
      console.warn('Redis set failed:', err);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      console.warn('Redis del failed:', err);
      return false;
    }
  }
}

// No-op cache for when Redis is unavailable
export class NoOpCache {
  async get(key: string): Promise<string | null> {
    return null;
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    return true; // Pretend success
  }

  async del(key: string): Promise<boolean> {
    return true; // Pretend success
  }
}

let cacheInstance: RedisCache | NoOpCache | null = null;

export async function getRedisCache(): Promise<RedisCache | NoOpCache> {
  if (cacheInstance) return cacheInstance;

  try {
    const client = await redis.getClient();
    if (client) {
      cacheInstance = new RedisCache(client);
    } else {
      cacheInstance = new NoOpCache();
    }
  } catch (err) {
    console.warn('Failed to initialize Redis cache, using no-op cache:', err);
    cacheInstance = new NoOpCache();
  }

  return cacheInstance;
}
