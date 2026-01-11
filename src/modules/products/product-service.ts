import { database } from '../../config/database';
import { getRedisCache } from '../../cache/redis-client';
import { CacheKeys, CacheTTL } from '../../cache/cache-keys';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { encodeCursor, decodeCursor } from '../../utils/validation';
import { RowDataPacket } from 'mysql2';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  farmerId: number;
  farmerName: string;
  stock: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductFilters {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
}

export interface ProductListParams {
  limit?: number;
  cursor?: string;
  sortBy?: 'price' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  filters?: ProductFilters;
}

export interface ProductListResult {
  products: Product[];
  nextCursor?: string;
  prevCursor?: string;
  total: number;
  hasMore: boolean;
}

export class ProductService {
  async getProducts(params: ProductListParams): Promise<ProductListResult> {
    const {
      limit = 20,
      cursor,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {},
    } = params;

    // Validate parameters
    if (limit > 100) {
      throw new ValidationError('Limit cannot exceed 100');
    }

    // Generate cache key
    const cacheKey = CacheKeys.PRODUCTS_LIST(JSON.stringify(params));
    
    // Try cache first
    const cache = await getRedisCache();
    const cachedStr = await cache.get(cacheKey);
    const cached = cachedStr ? JSON.parse(cachedStr) : null;
    if (cached) {
      console.log('Returning cached product list');
      return cached;
    }

    const db = database.getPool();
    
    try {
      // Build query
      const { query, countQuery, queryParams } = this.buildProductQuery(
        cursor,
        limit,
        sortBy,
        sortOrder,
        filters
      );

      // Execute queries in parallel
      const [productsResult, countResult] = await Promise.all([
        db.execute(query, queryParams),
        db.execute(countQuery, queryParams.slice(0, -2)), // Remove LIMIT and OFFSET params
      ]);

      const products = (productsResult[0] as RowDataPacket[]).map(this.mapRowToProduct);
      const total = (countResult[0] as RowDataPacket[])[0]?.total || 0;

      // Generate cursors
      const nextCursor = products.length === limit && products.length > 0
        ? encodeCursor(products[products.length - 1].id, products[products.length - 1].createdAt.toISOString())
        : undefined;

      const prevCursor = cursor && products.length > 0
        ? encodeCursor(products[0].id, products[0].createdAt.toISOString())
        : undefined;

      const result: ProductListResult = {
        products,
        nextCursor,
        prevCursor,
        total,
        hasMore: products.length === limit,
      };

      // Cache the result
      await cache.set(cacheKey, JSON.stringify(result), CacheTTL.PRODUCTS_LIST);

      console.log(`Retrieved ${products.length} products from database`);
      return result;
    } catch (error) {
      console.error('Failed to get products:', error);
      throw error;
    }
  }

  async getProductById(id: number): Promise<Product> {
    const cacheKey = CacheKeys.PRODUCT_DETAIL(id);
    
    // Try cache first
    const cache = await getRedisCache();
    const cachedStr = await cache.get(cacheKey);
    const cached = cachedStr ? JSON.parse(cachedStr) : null;
    if (cached) {
      console.log(`Returning cached product ${id}`);
      return cached;
    }

    const db = database.getPool();
    
    try {
      const [rows] = await db.execute(
        `SELECT p.*, f.name as farmer_name
         FROM products p
         JOIN farmers f ON p.farmer_id = f.id
         WHERE p.id = ?`,
        [id]
      );

      const products = rows as RowDataPacket[];
      
      if (products.length === 0) {
        throw new NotFoundError('Product');
      }

      const product = this.mapRowToProduct(products[0]);
      
      // Cache the result
      await cache.set(cacheKey, JSON.stringify(product), CacheTTL.PRODUCT_DETAIL);
      
      return product;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error(`Failed to get product ${id}:`, error);
      throw error;
    }
  }

  async searchProducts(
    searchTerm: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ products: Product[]; total: number }> {
    if (!searchTerm.trim()) {
      throw new ValidationError('Search term is required');
    }

    const cacheKey = CacheKeys.PRODUCTS_SEARCH(`${searchTerm}:${limit}:${offset}`);
    
    // Try cache first
    const cache = await getRedisCache();
    const cachedStr = await cache.get(cacheKey);
    const cached = cachedStr ? JSON.parse(cachedStr) : null;
    if (cached) {
      console.log('Returning cached search results');
      return cached;
    }

    const db = database.getPool();
    
    try {
      const searchPattern = `%${searchTerm}%`;
      
      // Search query with full-text search capabilities
      const searchQuery = `
        SELECT p.*, f.name as farmer_name,
               MATCH(p.name, p.description) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
        FROM products p
        JOIN farmers f ON p.farmer_id = f.id
        WHERE MATCH(p.name, p.description) AGAINST(? IN NATURAL LANGUAGE MODE)
           OR p.name LIKE ?
           OR p.description LIKE ?
        ORDER BY relevance DESC, p.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        WHERE MATCH(p.name, p.description) AGAINST(? IN NATURAL LANGUAGE MODE)
           OR p.name LIKE ?
           OR p.description LIKE ?
      `;

      const [productsResult, countResult] = await Promise.all([
        db.execute(searchQuery, [searchTerm, searchTerm, searchPattern, searchPattern, limit, offset]),
        db.execute(countQuery, [searchTerm, searchPattern, searchPattern]),
      ]);

      const products = (productsResult[0] as RowDataPacket[]).map(this.mapRowToProduct);
      const total = (countResult[0] as RowDataPacket[])[0]?.total || 0;

      const result = { products, total };
      
      // Cache the result
      await cache.set(cacheKey, JSON.stringify(result), CacheTTL.PRODUCTS_SEARCH);
      
      console.log(`Search for "${searchTerm}" returned ${products.length} products`);
      return result;
    } catch (error) {
      console.error(`Failed to search products for "${searchTerm}":`, error);
      throw error;
    }
  }

  async getProductCount(): Promise<number> {
    const cacheKey = CacheKeys.PRODUCTS_COUNT;
    
    // Try cache first
    const cache = await getRedisCache();
    const cachedStr = await cache.get(cacheKey);
    const cached = cachedStr ? parseInt(cachedStr) : null;
    if (cached !== null) {
      return cached;
    }

    const db = database.getPool();
    
    try {
      const [rows] = await db.execute('SELECT COUNT(*) as total FROM products');
      const count = (rows as RowDataPacket[])[0]?.total || 0;
      
      // Cache the result
      await cache.set(cacheKey, count.toString(), CacheTTL.PRODUCTS_COUNT);
      
      return count;
    } catch (error) {
      console.error('Failed to get product count:', error);
      throw error;
    }
  }

  private buildProductQuery(
    cursor?: string,
    limit: number = 20,
    sortBy: string = 'createdAt',
    sortOrder: string = 'desc',
    filters: ProductFilters = {}
  ): { query: string; countQuery: string; queryParams: any[] } {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    if (filters.category) {
      whereClause += ' AND p.category = ?';
      params.push(filters.category);
    }

    if (filters.priceMin !== undefined) {
      whereClause += ' AND p.price >= ?';
      params.push(filters.priceMin);
    }

    if (filters.priceMax !== undefined) {
      whereClause += ' AND p.price <= ?';
      params.push(filters.priceMax);
    }

    if (filters.search) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
    }

    // Apply cursor-based pagination
    if (cursor) {
      try {
        const { id, timestamp } = decodeCursor(cursor);
        
        if (sortBy === 'createdAt') {
          if (sortOrder === 'desc') {
            whereClause += ' AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))';
            params.push(timestamp, timestamp, id);
          } else {
            whereClause += ' AND (p.created_at > ? OR (p.created_at = ? AND p.id > ?))';
            params.push(timestamp, timestamp, id);
          }
        } else if (sortBy === 'price') {
          // For price sorting, we need to handle ties with ID
          if (sortOrder === 'desc') {
            whereClause += ' AND (p.price < (SELECT price FROM products WHERE id = ?) OR (p.price = (SELECT price FROM products WHERE id = ?) AND p.id < ?))';
            params.push(id, id, id);
          } else {
            whereClause += ' AND (p.price > (SELECT price FROM products WHERE id = ?) OR (p.price = (SELECT price FROM products WHERE id = ?) AND p.id > ?))';
            params.push(id, id, id);
          }
        }
      } catch (error) {
        throw new ValidationError('Invalid cursor format');
      }
    }

    // Build ORDER BY clause
    let orderBy = '';
    switch (sortBy) {
      case 'price':
        orderBy = `ORDER BY p.price ${sortOrder.toUpperCase()}, p.id ${sortOrder.toUpperCase()}`;
        break;
      case 'name':
        orderBy = `ORDER BY p.name ${sortOrder.toUpperCase()}, p.id ${sortOrder.toUpperCase()}`;
        break;
      case 'createdAt':
      default:
        orderBy = `ORDER BY p.created_at ${sortOrder.toUpperCase()}, p.id ${sortOrder.toUpperCase()}`;
        break;
    }

    const baseQuery = `
      FROM products p
      JOIN farmers f ON p.farmer_id = f.id
      ${whereClause}
    `;

    const query = `
      SELECT p.*, f.name as farmer_name
      ${baseQuery}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      ${baseQuery}
    `;

    // Add LIMIT and OFFSET to params for main query
    params.push(limit, 0); // We don't use OFFSET with cursor pagination

    return { query, countQuery, queryParams: params };
  }

  private mapRowToProduct(row: RowDataPacket): Product {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      category: row.category,
      farmerId: row.farmer_id,
      farmerName: row.farmer_name,
      stock: row.stock,
      imageUrl: row.image_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async invalidateProductCaches(productId?: number): Promise<void> {
    const cache = await getRedisCache();
    if (productId) {
      await cache.del(CacheKeys.PRODUCT_DETAIL(productId));
    }
    
    // Note: flushPattern is not available in our simple cache, so we skip pattern-based invalidation
    // In production, you might want to implement pattern-based cache invalidation
    await cache.del(CacheKeys.PRODUCTS_COUNT);
    
    console.log(`Invalidated product caches${productId ? ` for product ${productId}` : ''}`);
  }
}

export const productService = new ProductService();