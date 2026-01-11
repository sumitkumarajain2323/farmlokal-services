import { Router } from 'express';
import { body, query } from 'express-validator';
import { webhookService } from '@/modules/webhooks/webhook-service';
import { ResponseHelper } from '@/utils/response';
import { validate } from '@/utils/validation';
import { asyncHandler } from '@/middlewares/error-handler';
import { webhookRateLimiter, webhookDeduplication } from '@/middlewares/rate-limiter';
import { logger } from '@/utils/logger';

const router = Router();

// Apply rate limiting and deduplication to webhook routes
router.use(webhookRateLimiter.middleware());
router.use(webhookDeduplication.middleware());

// POST /webhooks/register - Register a new webhook
router.post(
  '/register',
  validate([
    body('url')
      .isURL()
      .withMessage('Valid URL is required'),
    body('events')
      .isArray({ min: 1 })
      .withMessage('At least one event type is required'),
    body('events.*')
      .isIn(['order.created', 'order.updated', 'product.updated', 'inventory.changed'])
      .withMessage('Invalid event type'),
  ]),
  asyncHandler(async (req, res) => {
    const { url, events } = req.body;

    const registration = await webhookService.registerWebhook(url, events);

    ResponseHelper.created(
      res,
      {
        id: registration.id,
        url: registration.url,
        events: registration.events,
        active: registration.active,
        createdAt: registration.createdAt,
        // Don't return the secret in the response for security
      },
      'Webhook registered successfully'
    );
  })
);

// POST /webhooks/events - Receive webhook events
router.post(
  '/events',
  validate([
    body('type')
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage('Event type is required'),
    body('data')
      .notEmpty()
      .withMessage('Event data is required'),
    body('timestamp')
      .optional()
      .isISO8601()
      .withMessage('Timestamp must be a valid ISO 8601 date'),
  ]),
  asyncHandler(async (req, res) => {
    const { type, data, timestamp } = req.body;
    const signature = req.headers['x-signature'] as string;
    const source = req.headers['x-webhook-source'] as string || 'external';

    logger.info('Received webhook event', {
      type,
      source,
      hasSignature: !!signature,
      timestamp,
    });

    const event = await webhookService.processWebhookEvent(
      type,
      data,
      signature,
      source
    );

    ResponseHelper.success(
      res,
      {
        eventId: event.id,
        processed: event.processed,
        timestamp: event.timestamp,
      },
      'Webhook event processed successfully'
    );
  })
);

// POST /webhooks/events/order-created - Specific endpoint for order created events
router.post(
  '/events/order-created',
  validate([
    body('orderId')
      .isInt({ min: 1 })
      .withMessage('Order ID must be a positive integer'),
    body('customerId')
      .isInt({ min: 1 })
      .withMessage('Customer ID must be a positive integer'),
    body('products')
      .isArray({ min: 1 })
      .withMessage('Products array is required'),
    body('products.*.productId')
      .isInt({ min: 1 })
      .withMessage('Product ID must be a positive integer'),
    body('products.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('products.*.price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('totalAmount')
      .isFloat({ min: 0 })
      .withMessage('Total amount must be a positive number'),
  ]),
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-signature'] as string;
    const source = req.headers['x-webhook-source'] as string || 'order-system';

    const event = await webhookService.processWebhookEvent(
      'order.created',
      req.body,
      signature,
      source
    );

    ResponseHelper.success(
      res,
      {
        eventId: event.id,
        processed: event.processed,
      },
      'Order created event processed successfully'
    );
  })
);

// POST /webhooks/events/inventory-changed - Specific endpoint for inventory changes
router.post(
  '/events/inventory-changed',
  validate([
    body('productId')
      .isInt({ min: 1 })
      .withMessage('Product ID must be a positive integer'),
    body('quantityChange')
      .isInt()
      .withMessage('Quantity change must be an integer'),
    body('newStock')
      .isInt({ min: 0 })
      .withMessage('New stock must be a non-negative integer'),
    body('reason')
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage('Reason must be between 1 and 255 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-signature'] as string;
    const source = req.headers['x-webhook-source'] as string || 'inventory-system';

    const event = await webhookService.processWebhookEvent(
      'inventory.changed',
      req.body,
      signature,
      source
    );

    ResponseHelper.success(
      res,
      {
        eventId: event.id,
        processed: event.processed,
      },
      'Inventory changed event processed successfully'
    );
  })
);

// GET /webhooks/events - List webhook events (for debugging/monitoring)
router.get(
  '/events',
  validate([
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    query('type')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Event type must be between 1 and 100 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const {
      limit = 50,
      offset = 0,
      type,
    } = req.query;

    const events = await webhookService.getWebhookEvents(
      parseInt(limit as string),
      parseInt(offset as string),
      type as string
    );

    const page = Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1;

    ResponseHelper.paginated(
      res,
      events,
      {
        page,
        limit: parseInt(limit as string),
        total: events.length, // This is a simplified total count
      },
      'Webhook events retrieved successfully'
    );
  })
);

export default router;