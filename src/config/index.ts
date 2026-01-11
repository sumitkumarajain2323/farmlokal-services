import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  API_VERSION: process.env.API_VERSION || 'v1',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'farmlokal',
    password: process.env.DB_PASSWORD || 'farmlokal123',
    name: process.env.DB_NAME || 'farmlokal_db',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  // OAuth2
  oauth: {
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    tokenUrl: process.env.OAUTH_TOKEN_URL || 'https://oauth-provider.com/token',
    scope: process.env.OAUTH_SCOPE || 'read:products write:orders',
  },

  // External APIs
  externalApis: {
    apiA: {
      url: process.env.EXTERNAL_API_A_URL || 'https://api.example.com',
      key: process.env.EXTERNAL_API_A_KEY || '',
    },
    apiB: {
      url: process.env.EXTERNAL_API_B_URL || 'https://webhook-api.example.com',
      secret: process.env.EXTERNAL_API_B_SECRET || '',
    },
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },

  // Cache TTL (in seconds)
  cache: {
    products: parseInt(process.env.CACHE_TTL_PRODUCTS || '300'), // 5 minutes
    oauthToken: parseInt(process.env.CACHE_TTL_OAUTH_TOKEN || '3600'), // 1 hour
  },

  // Webhook
  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'your_webhook_secret_here',
  },

  // Performance
  performance: {
    requestTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000, // 1 minute
  },
} as const;

export default config;