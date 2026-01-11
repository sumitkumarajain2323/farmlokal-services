import { Router } from 'express';
import { ResponseHelper } from '@/utils/response';
import config from '@/config';

// Import route modules
import productsRoutes from './products';
import webhooksRoutes from './webhooks';
import authRoutes from './auth';
import externalApiRoutes from './external-api';
import metricsRoutes from './metrics';

const router = Router();

// API root endpoint
router.get('/', (req, res) => {
  ResponseHelper.success(res, {
    name: 'FarmLokal Backend API',
    version: config.API_VERSION,
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      products: `/api/${config.API_VERSION}/products`,
      webhooks: `/api/${config.API_VERSION}/webhooks`,
      auth: `/api/${config.API_VERSION}/auth`,
      externalApi: `/api/${config.API_VERSION}/external-api`,
      metrics: `/api/${config.API_VERSION}/metrics`,
    },
    documentation: {
      products: 'GET /products - List products with pagination, sorting, and filtering',
      search: 'GET /products/search - Search products by name and description',
      webhooks: 'POST /webhooks/events - Receive webhook events',
      auth: 'GET /auth/token - Get OAuth token information',
      health: 'GET /metrics/health - System health check',
    },
  }, 'Welcome to FarmLokal Backend API');
});

// Mount route modules
router.use('/products', productsRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/auth', authRoutes);
router.use('/external-api', externalApiRoutes);
router.use('/metrics', metricsRoutes);

export default router;