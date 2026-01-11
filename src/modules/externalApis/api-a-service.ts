import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { redisCache } from '@/cache/redis-client';
import { CacheKeys, CacheTTL } from '@/cache/cache-keys';
import { logger } from '@/utils/logger';
import { ExternalAPIError, CircuitBreakerError } from '@/utils/errors';
import { oauthService } from '@/modules/auth/oauth-service';
import config from '@/config';

export interface ProductData {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  farmerId: number;
  stock: number;
  imageUrl?: string;
}

export interface OrderData {
  id: number;
  customerId: number;
  products: Array<{
    productId: number;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

export class ExternalAPIAService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly serviceName = 'external-api-a';

  constructor() {
    this.baseUrl = config.externalApis.apiA.url;
    this.apiKey = config.externalApis.apiA.key;
  }

  async getProducts(params: {
    page?: number;
    limit?: number;
    category?: string;
  } = {}): Promise<ProductData[]> {
    const cacheKey = CacheKeys.EXTERNAL_API_A('products', JSON.stringify(params));
    
    // Try cache first
    const cached = await redisCache.get<ProductData[]>(cacheKey);
    if (cached) {
      logger.debug('Returning cached external API A products');
      return cached;
    }

    // Check circuit breaker
    await this.checkCircuitBreaker();

    try {
      const response = await this.makeRequest<ProductData[]>('/api/products', {
        params,
      });

      // Cache the response
      await redisCache.set(cacheKey, response.data, CacheTTL.EXTERNAL_API_A);
      
      // Reset circuit breaker on success
      await this.resetCircuitBreaker();
      
      return response.data;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }

  async getProduct(productId: number): Promise<ProductData> {
    const cacheKey = CacheKeys.EXTERNAL_API_A('product', productId.toString());
    
    // Try cache first
    const cached = await redisCache.get<ProductData>(cacheKey);
    if (cached) {
      logger.debug(`Returning cached external API A product ${productId}`);
      return cached;
    }

    // Check circuit breaker
    await this.checkCircuitBreaker();

    try {
      const response = await this.makeRequest<ProductData>(`/api/products/${productId}`);
      
      // Cache the response
      await redisCache.set(cacheKey, response.data, CacheTTL.EXTERNAL_API_A);
      
      // Reset circuit breaker on success
      await this.resetCircuitBreaker();
      
      return response.data;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }

  async createOrder(orderData: Omit<OrderData, 'id' | 'createdAt'>): Promise<OrderData> {
    // Check circuit breaker
    await this.checkCircuitBreaker();

    try {
      const response = await this.makeRequest<OrderData>('/api/orders', {
        method: 'POST',
        data: orderData,
      });

      // Reset circuit breaker on success
      await this.resetCircuitBreaker();
      
      return response.data;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: AxiosRequestConfig = {}
  ): Promise<AxiosResponse<T>> {
    const accessToken = await oauthService.getAccessToken();
    
    const config: AxiosRequestConfig = {
      ...options,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: config.performance.requestTimeout,
    };

    return await this.executeWithRetry(config);
  }

  private async executeWithRetry<T>(
    config: AxiosRequestConfig,
    attempt: number = 1
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const shouldRetry = this.shouldRetry(error, attempt);
        
        if (shouldRetry && attempt < config.performance.retryAttempts) {
          const delay = this.calculateRetryDelay(attempt);
          logger.warn(`External API A request failed, retrying in ${delay}ms (attempt ${attempt})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeWithRetry(config, attempt + 1);
        }

        const status = error.response?.status || 500;
        const message = error.response?.data?.message || error.message;
        throw new ExternalAPIError(`External API A error: ${message}`, status);
      }
      
      throw error;
    }
  }

  private shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= config.performance.retryAttempts) {
      return false;
    }

    // Retry on network errors or 5xx status codes
    if (!error.response) {
      return true; // Network error
    }

    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors or rate limiting
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private async checkCircuitBreaker(): Promise<void> {
    const state = await this.getCircuitBreakerState();
    
    if (state.state === 'open') {
      const timeSinceLastFailure = Date.now() - state.lastFailureTime;
      
      if (timeSinceLastFailure < config.performance.circuitBreakerTimeout) {
        throw new CircuitBreakerError(this.serviceName);
      } else {
        // Move to half-open state
        await this.setCircuitBreakerState({
          ...state,
          state: 'half-open',
        });
      }
    }
  }

  private async recordFailure(): Promise<void> {
    const state = await this.getCircuitBreakerState();
    const newFailures = state.failures + 1;
    
    const newState: CircuitBreakerState = {
      failures: newFailures,
      lastFailureTime: Date.now(),
      state: newFailures >= config.performance.circuitBreakerThreshold ? 'open' : 'closed',
    };

    await this.setCircuitBreakerState(newState);
    
    if (newState.state === 'open') {
      logger.warn(`Circuit breaker opened for ${this.serviceName} after ${newFailures} failures`);
    }
  }

  private async resetCircuitBreaker(): Promise<void> {
    await this.setCircuitBreakerState({
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
    });
  }

  private async getCircuitBreakerState(): Promise<CircuitBreakerState> {
    const cached = await redisCache.get<CircuitBreakerState>(
      CacheKeys.CIRCUIT_BREAKER(this.serviceName)
    );
    
    return cached || {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
    };
  }

  private async setCircuitBreakerState(state: CircuitBreakerState): Promise<void> {
    await redisCache.set(
      CacheKeys.CIRCUIT_BREAKER(this.serviceName),
      state,
      CacheTTL.CIRCUIT_BREAKER
    );
  }

  async getCircuitBreakerStatus(): Promise<CircuitBreakerState> {
    return this.getCircuitBreakerState();
  }
}

export const externalAPIAService = new ExternalAPIAService();