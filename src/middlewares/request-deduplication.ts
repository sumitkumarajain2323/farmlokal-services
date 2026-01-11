import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redisCache } from '@/cache/redis-client';
import { CacheKeys, CacheTTL } from '@/cache/cache-keys';
import { logger } from '@/utils/logger';

export interface DeduplicationOptions {
  ttlSeconds?: number;
  keyGenerator?: (req: Request) => string;
  methods?: string[];
  skipPaths?: string[];
}

export class RequestDeduplication {
  private options: Required<DeduplicationOptions>;

  constructor(options: DeduplicationOptions = {}) {
    this.options = {
      ttlSeconds: options.ttlSeconds || CacheTTL.REQUEST_DEDUP,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      methods: options.methods || ['POST', 'PUT', 'PATCH'],
      skipPaths: options.skipPaths || [],
    };
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Skip deduplication for certain methods or paths
        if (!this.shouldDeduplicate(req)) {
          return next();
        }

        const deduplicationKey = this.options.keyGenerator(req);
        const cacheKey = CacheKeys.REQUEST_DEDUP(deduplicationKey);

        // Check if request is already being processed
        const existingRequest = await redisCache.get<{
          status: 'processing' | 'completed';
          response?: any;
          timestamp: number;
        }>(cacheKey);

        if (existingRequest) {
          if (existingRequest.status === 'processing') {
            // Request is currently being processed, wait and retry
            await this.waitForCompletion(cacheKey);
            const completedRequest = await redisCache.get<any>(cacheKey);
            
            if (completedRequest && completedRequest.response) {
              logger.info(`Returning cached response for duplicate request: ${deduplicationKey}`);
              res.status(completedRequest.response.statusCode)
                       .json(completedRequest.response.body);
              return;
            }
          } else if (existingRequest.status === 'completed' && existingRequest.response) {
            // Request was completed, return cached response
            logger.info(`Returning cached response for duplicate request: ${deduplicationKey}`);
            res.status(existingRequest.response.statusCode)
                     .json(existingRequest.response.body);
            return;
          }
        }

        // Mark request as processing
        await redisCache.set(cacheKey, {
          status: 'processing',
          timestamp: Date.now(),
        }, this.options.ttlSeconds);

        // Store original response methods
        const originalJson = res.json;
        const originalStatus = res.status;
        let responseData: any = null;
        let statusCode = 200;

        // Override response methods to capture response
        res.status = function(code: number) {
          statusCode = code;
          return originalStatus.call(this, code);
        };

        res.json = function(body: any) {
          responseData = body;
          return originalJson.call(this, body);
        };

        // Override end method to cache successful responses
        const originalEnd = res.end;
        res.end = function(this: Response, ...args: any[]) {
          // Use setTimeout to handle async operations without changing return type
          setTimeout(async () => {
            try {
              // Only cache successful responses (2xx status codes)
              if (statusCode >= 200 && statusCode < 300 && responseData) {
                await redisCache.set(cacheKey, {
                  status: 'completed',
                  response: {
                    statusCode,
                    body: responseData,
                  },
                  timestamp: Date.now(),
                }, requestDedup.options.ttlSeconds);
                
                logger.debug(`Cached response for request: ${deduplicationKey}`);
              } else {
                // Remove processing marker for failed requests
                await redisCache.del(cacheKey);
              }
            } catch (error) {
              logger.error('Failed to cache response for deduplication:', error);
            }
          }, 0);
          
          return originalEnd.apply(this, args as any);
        };

        next();
      } catch (error) {
        logger.error('Request deduplication error:', error);
        next(); // Continue without deduplication on error
      }
    };
  }

  private shouldDeduplicate(req: Request): boolean {
    // Check method
    if (!this.options.methods.includes(req.method)) {
      return false;
    }

    // Check skip paths
    if (this.options.skipPaths.some(path => req.path.startsWith(path))) {
      return false;
    }

    return true;
  }

  private defaultKeyGenerator(req: Request): string {
    // Generate key based on method, path, query, body, and user
    const components = [
      req.method,
      req.path,
      JSON.stringify(req.query),
      req.body ? JSON.stringify(req.body) : '',
      (req as any).user?.id || req.ip, // Include user ID if available
    ];

    const content = components.join('|');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async waitForCompletion(cacheKey: string, maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (Date.now() - startTime < maxWaitMs) {
      const request = await redisCache.get<any>(cacheKey);
      
      if (!request || request.status === 'completed') {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    logger.warn(`Timeout waiting for request completion: ${cacheKey}`);
  }
}

// Create deduplication middleware instances
export const requestDeduplication = new RequestDeduplication({
  ttlSeconds: 300, // 5 minutes
  methods: ['POST', 'PUT', 'PATCH'],
});

export const strictRequestDeduplication = new RequestDeduplication({
  ttlSeconds: 60, // 1 minute
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
});

export const webhookDeduplication = new RequestDeduplication({
  ttlSeconds: 3600, // 1 hour for webhooks
  methods: ['POST'],
  keyGenerator: (req: Request) => {
    // For webhooks, use headers and body for deduplication
    const eventId = req.headers['x-event-id'] || req.headers['x-webhook-id'];
    const signature = req.headers['x-signature'] || req.headers['x-hub-signature'];
    
    if (eventId) {
      return `webhook:${eventId}`;
    }

    // Fallback to body-based deduplication
    const content = JSON.stringify({
      headers: {
        'x-event-type': req.headers['x-event-type'],
        'x-source': req.headers['x-source'],
      },
      body: req.body,
    });
    
    return `webhook:${crypto.createHash('sha256').update(content).digest('hex')}`;
  },
});

const requestDedup = requestDeduplication;