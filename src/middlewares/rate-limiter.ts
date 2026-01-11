import { Request, Response, NextFunction } from 'express';
import { getRedisCache } from '../cache/redis-client';

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `rate:${ip}`;

  try {
    const cache = await getRedisCache();
    const current = await cache.get(key);

    if (current && Number(current) > 100) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    await cache.set(key, String((Number(current) || 0) + 1), 60);
    next();
  } catch (err) {
    console.warn('Rate limiter failed, allowing request:', err);
    next(); // fail open
  }
}

// Express-rate-limit style middleware factory
export const generalRateLimiter = {
  middleware: () => rateLimiter
};

// Strict rate limiter for sensitive endpoints
export const strictRateLimiter = {
  middleware: () => rateLimiter // Using same implementation for now
};

// API rate limiter for general API endpoints
export const apiRateLimiter = {
  middleware: () => rateLimiter
};

// Webhook rate limiter for webhook endpoints
export const webhookRateLimiter = {
  middleware: () => rateLimiter
};
