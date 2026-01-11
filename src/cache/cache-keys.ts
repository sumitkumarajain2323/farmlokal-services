export const CacheKeys = {
  // OAuth tokens
  OAUTH_TOKEN: 'oauth:token',
  OAUTH_LOCK: 'oauth:lock',

  // Products
  PRODUCTS_LIST: (params: string) => `products:list:${params}`,
  PRODUCT_DETAIL: (id: number) => `product:${id}`,
  PRODUCTS_SEARCH: (query: string) => `products:search:${query}`,
  PRODUCTS_COUNT: 'products:count',

  // Rate limiting
  RATE_LIMIT: (ip: string) => `rate_limit:${ip}`,
  
  // Circuit breaker
  CIRCUIT_BREAKER: (service: string) => `circuit_breaker:${service}`,
  
  // Request deduplication
  REQUEST_DEDUP: (hash: string) => `request_dedup:${hash}`,
  
  // Webhook events
  WEBHOOK_EVENT: (eventId: string) => `webhook:event:${eventId}`,
  
  // External API responses
  EXTERNAL_API_A: (endpoint: string, params: string) => `external_api_a:${endpoint}:${params}`,
  
  // Metrics
  METRICS: (type: string, period: string) => `metrics:${type}:${period}`,
} as const;

export const CacheTTL = {
  OAUTH_TOKEN: 3600, // 1 hour
  OAUTH_LOCK: 30, // 30 seconds
  PRODUCTS_LIST: 300, // 5 minutes
  PRODUCT_DETAIL: 600, // 10 minutes
  PRODUCTS_SEARCH: 180, // 3 minutes
  PRODUCTS_COUNT: 3600, // 1 hour
  RATE_LIMIT: 900, // 15 minutes
  CIRCUIT_BREAKER: 60, // 1 minute
  REQUEST_DEDUP: 300, // 5 minutes
  WEBHOOK_EVENT: 86400, // 24 hours
  EXTERNAL_API_A: 600, // 10 minutes
  METRICS: 300, // 5 minutes
} as const;