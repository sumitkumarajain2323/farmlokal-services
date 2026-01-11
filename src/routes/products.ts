import { Router } from 'express';
import { query } from 'express-validator';
import { productService } from '@/modules/products/product-service';
import { ResponseHelper } from '@/utils/response';
import { validate, validateCursor } from '@/utils/validation';
import { asyncHandler } from '@/middlewares/error-handler';
import { apiRateLimiter } from '@/middlewares/rate-limiter';
import { ValidationError, NotFoundError } from '@/utils/errors';

const router = Router();

// Apply rate limiting to all product routes
router.use(apiRateLimiter.middleware());

// GET /products - List products with pagination, sorting, and filtering
router.get(
  '/',
  validate([
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('cursor')
      .optional()
      .custom((value) => {
        if (value && !validateCursor(value)) {
          throw new Error('Invalid cursor format');
        }
        return true;
      }),
    query('sortBy')
      .optional()
      .isIn(['price', 'createdAt', 'name'])
      .withMessage('Sort by must be one of: price, createdAt, name'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
    query('category')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    query('priceMin')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be a positive number'),
    query('priceMax')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be a positive number'),
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be between 1 and 100 characters'),
  ]),
  asyncHandler(async (req, res) => {
    const {
      limit = 20,
      cursor,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      category,
      priceMin,
      priceMax,
      search,
    } = req.query;

    // Validate price range
    if (priceMin && priceMax && parseFloat(priceMin as string) > parseFloat(priceMax as string)) {
      throw new ValidationError('Minimum price cannot be greater than maximum price');
    }

    const filters = {
      category: category as string,
      priceMin: priceMin ? parseFloat(priceMin as string) : undefined,
      priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
      search: search as string,
    };

    const result = await productService.getProducts({
      limit: parseInt(limit as string),
      cursor: cursor as string,
      sortBy: sortBy as 'price' | 'createdAt' | 'name',
      sortOrder: sortOrder as 'asc' | 'desc',
      filters,
    });

    ResponseHelper.paginated(
      res,
      result.products,
      {
        page: 1, // Cursor-based pagination doesn't use page numbers
        limit: parseInt(limit as string),
        total: result.total,
        nextCursor: result.nextCursor,
        prevCursor: result.prevCursor,
      },
      'Products retrieved successfully'
    );
  })
);

// GET /products/search - Search products
router.get(
  '/search',
  validate([
    query('q')
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query is required and must be between 1 and 100 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
  ]),
  asyncHandler(async (req, res) => {
    const {
      q: searchTerm,
      limit = 20,
      offset = 0,
    } = req.query;

    const result = await productService.searchProducts(
      searchTerm as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    const page = Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1;

    ResponseHelper.paginated(
      res,
      result.products,
      {
        page,
        limit: parseInt(limit as string),
        total: result.total,
      },
      `Found ${result.products.length} products matching "${searchTerm}"`
    );
  })
);

// GET /products/:id - Get product by ID
router.get(
  '/:id',
  validate([
    query('id')
      .isInt({ min: 1 })
      .withMessage('Product ID must be a positive integer'),
  ]),
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id);

    if (isNaN(productId) || productId <= 0) {
      throw new ValidationError('Invalid product ID');
    }

    const product = await productService.getProductById(productId);

    ResponseHelper.success(
      res,
      product,
      'Product retrieved successfully'
    );
  })
);

// GET /products/count - Get total product count
router.get(
  '/count',
  asyncHandler(async (req, res) => {
    const count = await productService.getProductCount();

    ResponseHelper.success(
      res,
      { count },
      'Product count retrieved successfully'
    );
  })
);

export default router;