import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import { RedisClientType } from 'redis';

export class RedisCache {
  private client: RedisClientType;

  constructor() {
    this.client = redis.getClient();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const result = await this.client.incr(key);
      
      if (ttlSeconds && result === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      
      return result;
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      throw error;
    }
  }

  async setNX(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        const result = await this.client.set(key, serialized, {
          NX: true,
          EX: ttlSeconds,
        });
        return result === 'OK';
      } else {
        const result = await this.client.setNX(key, serialized);
        return result;
      }
    } catch (error) {
      logger.error(`Redis SETNX error for key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result;
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }

  async flushPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error(`Redis flush pattern error for ${pattern}:`, error);
    }
  }

  async pipeline(operations: Array<() => Promise<any>>): Promise<any[]> {
    try {
      const multi = this.client.multi();
      
      for (const operation of operations) {
        await operation();
      }
      
      return await multi.exec();
    } catch (error) {
      logger.error('Redis pipeline error:', error);
      throw error;
    }
  }
}

export const redisCache = new RedisCache();