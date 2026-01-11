import { Router } from 'express';
import { query, body } from 'express-validator';
import { externalAPIAService } from '@/modules/externalApis/api-a-service';
import { ResponseHelper } from '@/utils/response';
import { validate } from '@/utils/validation';
import { asyncHandler } from '@/middlewares/error-handler';
import { apiRateLimiter } from '@/middlewares/rate-limiter';

const router = Router();

// Apply rate limiting to external API routes
router.use(apiRateLimiter.middleware());

// GET /external-api/products - Get products from external API A
router.get(
  '/products',
  validate([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      category,
    } = req.query;

    const products = await externalAPIAService.getProducts({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      category: category as string,
    });

    ResponseHelper.success(
      res,
      products,
      'External products retrieved successfully'
    );
  })
);

// GET /external-api/products/:id - Get specific product from external API A
router.get(
  '/products/:id',
  validate([
    query('id')
      .isInt({ min: 1 })
      .withMessage('Product ID must be a positive integer'),
  ]),
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id);

    const product = await externalAPIAService.getProduct(productId);

    ResponseHelper.success(
      res,
      product,
      'External product retrieved successfully'
    );
  })
);

// POST /external-api/orders - Create order via external API A
router.post(
  '/orders',
  validate([
    body('customerId')
      .isInt({ min: 1 })
      .withMessage('Customer ID must be a positive integer'),
    body('products')
      .isArray({ min: 1 })
      .withMessage('Products array is required and must not be empty'),
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
    body('status')
      .optional()
      .isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
      .withMessage('Invalid status'),
  ]),
  asyncHandler(async (req, res) => {
    const orderData = req.body;

    const order = await externalAPIAService.createOrder(orderData);

    ResponseHelper.created(
      res,
      order,
      'Order created successfully via external API'
    );
  })
);

// GET /external-api/circuit-breaker/status - Get circuit breaker status
router.get(
  '/circuit-breaker/status',
  asyncHandler(async (req, res) => {
    const status = await externalAPIAService.getCircuitBreakerStatus();

    ResponseHelper.success(
      res,
      {
        service: 'external-api-a',
        ...status,
        isHealthy: status.state === 'closed',
      },
      'Circuit breaker status retrieved successfully'
    );
  })
);

export default router;