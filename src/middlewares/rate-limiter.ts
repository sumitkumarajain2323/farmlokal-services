import { Request, Response, NextFunction } from 'express';
import { redisCache } from '@/cache/redis-client';
import { CacheKeys, CacheTTL } from '@/cache/cache-keys';
import { RateLimitError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import config from '@/config';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimiter {
  private options: RateLimitOptions;

  constructor(options: Partial<RateLimitOptions> = {}) {
    this.options = {
      windowMs: config.rateLimit.windowMs,
      maxRequests: config.rateLimit.maxRequests,
      keyGenerator: (req: Request) => req.ip,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...options,
    };
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.options.keyGenerator!(req);
        const rateLimitKey = CacheKeys.RATE_LIMIT(key);
        
        // Get current request count
        const currentCount = await redisCache.get<number>(rateLimitKey) || 0;
        
        // Check if limit exceeded
        if (currentCount >= this.options.maxRequests) {
          const ttl = await redisCache.ttl(rateLimitKey);
          const resetTime = new Date(Date.now() + (ttl * 1000));
          
          // Set rate limit headers
          res.set({
            'X-RateLimit-Limit': this.options.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toISOString(),
            'Retry-After': ttl.toString(),
          });
          
          logger.warn(`Rate limit exceeded for ${key}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            currentCount,
            limit: this.options.maxRequests,
          });
          
          throw new RateLimitError('Too many requests, please try again later');
        }
        
        // Increment counter
        const newCount = await redisCache.increment(
          rateLimitKey,
          Math.ceil(this.options.windowMs / 1000)
        );
        
        // Set rate limit headers
        const remaining = Math.max(0, this.options.maxRequests - newCount);
        const ttl = await redisCache.ttl(rateLimitKey);
        const resetTime = new Date(Date.now() + (ttl * 1000));
        
        res.set({
          'X-RateLimit-Limit': this.options.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': resetTime.toISOString(),
        });
        
        // Store original end function to handle response-based rate limiting
        if (!this.options.skipSuccessfulRequests || !this.options.skipFailedRequests) {
          const originalEnd = res.end;
          
          res.end = function(this: Response, ...args: any[]) {
            const shouldSkip = 
              (rateLimiter.options.skipSuccessfulRequests && res.statusCode < 400) ||
              (rateLimiter.options.skipFailedRequests && res.statusCode >= 400);
            
            if (shouldSkip) {
              // Decrement counter if we should skip this request
              redisCache.increment(rateLimitKey, -1).catch(err => {
                logger.error('Failed to decrement rate limit counter:', err);
              });
            }
            
            return originalEnd.apply(this, args);
          };
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

// Create different rate limiters for different endpoints
export const generalRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
});

export const strictRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20,
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 60, // 1 request per second average
});

export const webhookRateLimiter = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 100,
  keyGenerator: (req: Request) => {
    // Rate limit by IP and webhook source if available
    const source = req.headers['x-webhook-source'] || 'unknown';
    return `${req.ip}:${source}`;
  },
});

// IP-based rate limiter
export const ipRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // High limit for general IP-based limiting
  keyGenerator: (req: Request) => req.ip,
});

// User-based rate limiter (requires authentication)
export const userRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 500,
  keyGenerator: (req: Request) => {
    // Assuming user ID is available in req.user after authentication
    const userId = (req as any).user?.id || req.ip;
    return `user:${userId}`;
  },
});

const rateLimiter = generalRateLimiter;