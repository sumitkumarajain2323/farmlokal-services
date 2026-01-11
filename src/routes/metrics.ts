import { Router } from 'express';
import { query } from 'express-validator';
import { database } from '@/config/database';
import { redisCache } from '@/cache/redis-client';
import { CacheKeys, CacheTTL } from '@/cache/cache-keys';
import { ResponseHelper } from '@/utils/response';
import { validate } from '@/utils/validation';
import { asyncHandler } from '@/middlewares/error-handler';
import { strictRateLimiter } from '@/middlewares/rate-limiter';
import { logger } from '@/utils/logger';
import { RowDataPacket } from 'mysql2';

const router = Router();

// Apply strict rate limiting to metrics routes
router.use(strictRateLimiter.middleware());

// GET /metrics - Get system metrics
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cacheKey = CacheKeys.METRICS('system', 'current');
    
    // Try cache first
    const cached = await redisCache.get<any>(cacheKey);
    if (cached) {
      return ResponseHelper.success(res, cached, 'System metrics retrieved from cache');
    }

    const db = database.getPool();
    
    try {
      // Get database metrics
      const [dbStats] = await db.execute(`
        SELECT 
          (SELECT COUNT(*) FROM products) as total_products,
          (SELECT COUNT(*) FROM farmers) as total_farmers,
          (SELECT COUNT(*) FROM webhook_events) as total_webhook_events,
          (SELECT COUNT(*) FROM webhook_events WHERE processed = true) as processed_webhook_events,
          (SELECT COUNT(*) FROM webhook_events WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)) as recent_webhook_events
      `);

      const dbMetrics = (dbStats as RowDataPacket[])[0];

      // Get Redis metrics
      const redisClient = redisCache;
      const redisInfo = {
        connected: true, // If we got here, Redis is connected
        // Add more Redis metrics as needed
      };

      // Calculate performance metrics
      const performanceMetrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      };

      const metrics = {
        timestamp: new Date().toISOString(),
        database: {
          totalProducts: dbMetrics.total_products,
          totalFarmers: dbMetrics.total_farmers,
          totalWebhookEvents: dbMetrics.total_webhook_events,
          processedWebhookEvents: dbMetrics.processed_webhook_events,
          recentWebhookEvents: dbMetrics.recent_webhook_events,
          webhookProcessingRate: dbMetrics.total_webhook_events > 0 
            ? (dbMetrics.processed_webhook_events / dbMetrics.total_webhook_events * 100).toFixed(2) + '%'
            : '0%',
        },
        cache: {
          redis: redisInfo,
        },
        performance: {
          uptime: `${Math.floor(performanceMetrics.uptime / 3600)}h ${Math.floor((performanceMetrics.uptime % 3600) / 60)}m`,
          memory: {
            used: `${Math.round(performanceMetrics.memory.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(performanceMetrics.memory.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(performanceMetrics.memory.external / 1024 / 1024)}MB`,
          },
          cpu: {
            user: performanceMetrics.cpu.user,
            system: performanceMetrics.cpu.system,
          },
        },
      };

      // Cache metrics for 5 minutes
      await redisCache.set(cacheKey, metrics, CacheTTL.METRICS);

      return ResponseHelper.success(res, metrics, 'System metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      throw error;
    }
  })
);

// GET /metrics/products - Get product-specific metrics
router.get(
  '/products',
  validate([
    query('period')
      .optional()
      .isIn(['hour', 'day', 'week', 'month'])
      .withMessage('Period must be one of: hour, day, week, month'),
  ]),
  asyncHandler(async (req, res) => {
    const period = (req.query.period as string) || 'day';
    const cacheKey = CacheKeys.METRICS('products', period);
    
    // Try cache first
    const cached = await redisCache.get<any>(cacheKey);
    if (cached) {
      return ResponseHelper.success(res, cached, 'Product metrics retrieved from cache');
    }

    const db = database.getPool();
    
    try {
      let dateFilter = '';
      switch (period) {
        case 'hour':
          dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 HOUR)';
          break;
        case 'day':
          dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
          break;
        case 'week':
          dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 WEEK)';
          break;
        case 'month':
          dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 MONTH)';
          break;
      }

      const [productStats] = await db.execute(`
        SELECT 
          COUNT(*) as total_products,
          AVG(price) as average_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          SUM(stock) as total_stock,
          COUNT(DISTINCT category) as total_categories,
          COUNT(DISTINCT farmer_id) as active_farmers
        FROM products 
        WHERE created_at > ${dateFilter}
      `);

      const [categoryStats] = await db.execute(`
        SELECT 
          category,
          COUNT(*) as product_count,
          AVG(price) as avg_price,
          SUM(stock) as total_stock
        FROM products 
        WHERE created_at > ${dateFilter}
        GROUP BY category 
        ORDER BY product_count DESC 
        LIMIT 10
      `);

      const productMetrics = (productStats as RowDataPacket[])[0];
      const categoryBreakdown = categoryStats as RowDataPacket[];

      const metrics = {
        timestamp: new Date().toISOString(),
        period,
        overview: {
          totalProducts: productMetrics.total_products,
          averagePrice: parseFloat(productMetrics.average_price || 0).toFixed(2),
          priceRange: {
            min: parseFloat(productMetrics.min_price || 0).toFixed(2),
            max: parseFloat(productMetrics.max_price || 0).toFixed(2),
          },
          totalStock: productMetrics.total_stock,
          totalCategories: productMetrics.total_categories,
          activeFarmers: productMetrics.active_farmers,
        },
        categoryBreakdown: categoryBreakdown.map(cat => ({
          category: cat.category,
          productCount: cat.product_count,
          averagePrice: parseFloat(cat.avg_price).toFixed(2),
          totalStock: cat.total_stock,
        })),
      };

      // Cache metrics for 5 minutes
      await redisCache.set(cacheKey, metrics, CacheTTL.METRICS);

      return ResponseHelper.success(res, metrics, 'Product metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get product metrics:', error);
      throw error;
    }
  })
);

// GET /metrics/webhooks - Get webhook-specific metrics
router.get(
  '/webhooks',
  validate([
    query('period')
      .optional()
      .isIn(['hour', 'day', 'week', 'month'])
      .withMessage('Period must be one of: hour, day, week, month'),
  ]),
  asyncHandler(async (req, res) => {
    const period = (req.query.period as string) || 'day';
    const cacheKey = CacheKeys.METRICS('webhooks', period);
    
    // Try cache first
    const cached = await redisCache.get<any>(cacheKey);
    if (cached) {
      return ResponseHelper.success(res, cached, 'Webhook metrics retrieved from cache');
    }

    const db = database.getPool();
    
    try {
      let dateFilter = '';
      switch (period) {
        case 'hour':
          dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 HOUR)';
          break;
        case 'day':
          dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
          break;
        case 'week':
          dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 WEEK)';
          break;
        case 'month':
          dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 MONTH)';
          break;
      }

      const [webhookStats] = await db.execute(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN processed = true THEN 1 END) as processed_events,
          COUNT(CASE WHEN processed = false THEN 1 END) as pending_events,
          COUNT(CASE WHEN retry_count > 0 THEN 1 END) as retried_events,
          AVG(retry_count) as avg_retry_count,
          COUNT(DISTINCT type) as event_types,
          COUNT(DISTINCT source) as event_sources
        FROM webhook_events 
        WHERE created_at > ${dateFilter}
      `);

      const [eventTypeStats] = await db.execute(`
        SELECT 
          type,
          COUNT(*) as event_count,
          COUNT(CASE WHEN processed = true THEN 1 END) as processed_count,
          AVG(retry_count) as avg_retries
        FROM webhook_events 
        WHERE created_at > ${dateFilter}
        GROUP BY type 
        ORDER BY event_count DESC
      `);

      const webhookMetrics = (webhookStats as RowDataPacket[])[0];
      const eventTypeBreakdown = eventTypeStats as RowDataPacket[];

      const processingRate = webhookMetrics.total_events > 0 
        ? (webhookMetrics.processed_events / webhookMetrics.total_events * 100).toFixed(2)
        : '0';

      const metrics = {
        timestamp: new Date().toISOString(),
        period,
        overview: {
          totalEvents: webhookMetrics.total_events,
          processedEvents: webhookMetrics.processed_events,
          pendingEvents: webhookMetrics.pending_events,
          retriedEvents: webhookMetrics.retried_events,
          processingRate: `${processingRate}%`,
          averageRetryCount: parseFloat(webhookMetrics.avg_retry_count || 0).toFixed(2),
          eventTypes: webhookMetrics.event_types,
          eventSources: webhookMetrics.event_sources,
        },
        eventTypeBreakdown: eventTypeBreakdown.map(type => ({
          type: type.type,
          eventCount: type.event_count,
          processedCount: type.processed_count,
          processingRate: type.event_count > 0 
            ? `${(type.processed_count / type.event_count * 100).toFixed(2)}%`
            : '0%',
          averageRetries: parseFloat(type.avg_retries).toFixed(2),
        })),
      };

      // Cache metrics for 5 minutes
      await redisCache.set(cacheKey, metrics, CacheTTL.METRICS);

      return ResponseHelper.success(res, metrics, 'Webhook metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get webhook metrics:', error);
      throw error;
    }
  })
);

// GET /metrics/health - Health check endpoint
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'unknown',
        application: 'healthy',
      },
    };

    try {
      // Check database connection
      const db = database.getPool();
      await db.execute('SELECT 1');
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }

    try {
      // Check Redis connection
      await redisCache.set('health_check', 'ok', 10);
      await redisCache.get('health_check');
      health.services.redis = 'healthy';
    } catch (error) {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    ResponseHelper.success(
      res,
      health,
      `System is ${health.status}`,
      statusCode
    );
  })
);

export default router;