# FarmLokal Backend

A high-performance, production-ready backend for FarmLokal - a hyperlocal marketplace connecting customers with local farmers.

## 🚀 Features

### Core Functionality
- **OAuth2 Client Credentials Authentication** with token caching and automatic refresh
- **High-Performance Product Listing API** with cursor-based pagination, sorting, and filtering
- **External API Integration** with retry logic, circuit breaker, and caching
- **Webhook System** with idempotency, duplicate detection, and safe retry handling
- **Redis Caching** for optimal performance and reduced database load
- **Rate Limiting** to prevent abuse and ensure fair usage

### Performance & Reliability
- **P95 < 200ms** for product listing API
- **1M+ products** support with optimized database indexes
- **Circuit breaker** pattern for external API resilience
- **Request deduplication** to prevent duplicate processing
- **Connection pooling** for database optimization
- **Comprehensive error handling** with proper HTTP status codes

### Production Ready
- **Docker containerization** with multi-stage builds
- **Comprehensive logging** with structured JSON format
- **Health checks** and metrics endpoints
- **Security middleware** with Helmet, CORS, and rate limiting
- **Graceful shutdown** handling
- **Environment-based configuration**

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Database**: MySQL 8.0 with optimized indexes
- **Cache**: Redis 7 for caching and rate limiting
- **Framework**: Express.js with security middleware
- **Containerization**: Docker with Alpine Linux

### Project Structure
```
src/
├── config/           # Database, Redis, and app configuration
├── modules/          # Business logic modules
│   ├── auth/         # OAuth2 authentication service
│   ├── products/     # Product management service
│   ├── externalApis/ # External API integration
│   └── webhooks/     # Webhook processing service
├── database/         # Database schema and migrations
├── cache/            # Redis client and cache management
├── middlewares/      # Express middlewares
├── routes/           # API route definitions
└── utils/            # Utility functions and helpers
```

## 🚦 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0
- Redis 7
- Docker (optional)

### Local Development

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd farmlokal-backend
npm install
```

2. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database setup**
```bash
# Run migrations
npm run migrate

# Seed with sample data (1M products)
npm run seed
```

4. **Start development server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Docker Deployment

1. **Using Docker Compose (Recommended)**
```bash
docker-compose up -d
```

2. **Run migrations and seeding**
```bash
docker-compose exec farmlokal-api npm run migrate
docker-compose exec farmlokal-api npm run seed
```

## 📚 API Documentation

### Base URL
- Development: `http://localhost:3000/api/v1`
- Production: `https://your-domain.com/api/v1`

### Core Endpoints

#### Products API
```http
GET /products
```
**Features:**
- Cursor-based pagination for optimal performance
- Sorting by `price`, `createdAt`, `name`
- Filtering by `category`, `priceMin`, `priceMax`
- Full-text search capability
- Redis caching with 5-minute TTL

**Query Parameters:**
- `limit` (1-100): Number of products per page
- `cursor`: Pagination cursor for next/previous page
- `sortBy`: Sort field (`price`, `createdAt`, `name`)
- `sortOrder`: Sort direction (`asc`, `desc`)
- `category`: Filter by product category
- `priceMin`/`priceMax`: Price range filtering
- `search`: Search in name and description

**Example:**
```bash
curl "http://localhost:3000/api/v1/products?limit=20&sortBy=price&sortOrder=asc&category=Vegetables&priceMin=10&priceMax=100"
```

#### Product Search
```http
GET /products/search?q=tomatoes
```

#### Webhook Events
```http
POST /webhooks/events
```
**Features:**
- Signature verification for security
- Idempotency to prevent duplicate processing
- Automatic retry with exponential backoff
- Event storage for audit trail

#### Authentication
```http
GET /auth/token
POST /auth/token/refresh
DELETE /auth/token
```

#### System Metrics
```http
GET /metrics
GET /metrics/products
GET /metrics/webhooks
GET /metrics/health
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `3000` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `farmlokal` |
| `DB_PASSWORD` | MySQL password | `farmlokal123` |
| `DB_NAME` | MySQL database name | `farmlokal_db` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `OAUTH_CLIENT_ID` | OAuth2 client ID | - |
| `OAUTH_CLIENT_SECRET` | OAuth2 client secret | - |
| `OAUTH_TOKEN_URL` | OAuth2 token endpoint | - |

### Database Configuration

The application uses MySQL with optimized indexes for high performance:

**Key Indexes:**
- `idx_products_created_at_id` - Cursor pagination
- `idx_products_category_price` - Category + price filtering
- `ft_products_search` - Full-text search
- `idx_products_price_id` - Price sorting

**Performance Optimizations:**
- Connection pooling (10 connections by default)
- Query optimization for large datasets
- Proper index usage for all query patterns

### Redis Configuration

Redis is used for:
- **OAuth token caching** (1 hour TTL)
- **Product list caching** (5 minutes TTL)
- **Rate limiting** (sliding window)
- **Request deduplication** (5 minutes TTL)
- **Circuit breaker state** (1 minute TTL)

## 🎯 Performance Optimizations

### Caching Strategy

1. **Multi-level Caching**
   - Redis for frequently accessed data
   - Application-level caching for static data
   - Database query result caching

2. **Cache Invalidation**
   - Smart invalidation on data updates
   - Pattern-based cache clearing
   - TTL-based expiration

3. **Cache Keys Structure**
   ```
   products:list:{params_hash}
   product:{id}
   oauth:token
   rate_limit:{ip}
   ```

### Database Optimizations

1. **Indexing Strategy**
   - Composite indexes for common query patterns
   - Full-text indexes for search functionality
   - Covering indexes to avoid table lookups

2. **Query Optimization**
   - Cursor-based pagination (no OFFSET)
   - Efficient JOIN operations
   - Proper WHERE clause ordering

3. **Connection Management**
   - Connection pooling with proper limits
   - Connection health monitoring
   - Graceful connection handling

### API Performance

1. **Response Time Targets**
   - P50: < 50ms
   - P95: < 200ms
   - P99: < 500ms

2. **Throughput Optimization**
   - Async/await for non-blocking operations
   - Parallel processing where possible
   - Efficient serialization

## 🛡️ Security Features

### Authentication & Authorization
- OAuth2 Client Credentials flow
- Secure token storage in Redis
- Automatic token refresh with locking

### API Security
- Rate limiting (100 requests/15 minutes)
- Request deduplication
- Input validation and sanitization
- CORS configuration
- Security headers (Helmet.js)

### Data Protection
- SQL injection prevention
- XSS protection
- CSRF protection
- Secure cookie handling

## 📊 Monitoring & Observability

### Health Checks
```http
GET /health
GET /metrics/health
```

### Metrics Endpoints
- System metrics (uptime, memory, CPU)
- Database metrics (connection count, query performance)
- Cache metrics (hit rate, memory usage)
- API metrics (request count, response times)

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking with stack traces
- Performance monitoring

## 🔄 External API Integration

### API A (Synchronous)
- **Timeout**: 30 seconds
- **Retry**: 3 attempts with exponential backoff
- **Circuit Breaker**: Opens after 5 failures
- **Caching**: 10 minutes TTL

### API B (Webhook/Callback)
- **Idempotency**: Duplicate event detection
- **Signature Verification**: HMAC-SHA256
- **Retry Logic**: Exponential backoff up to 3 attempts
- **Event Storage**: All events stored for audit

## 🚀 Deployment

### Docker Production Deployment

1. **Build and deploy**
```bash
docker-compose -f docker-compose.yml up -d
```

2. **Initialize database**
```bash
docker-compose exec farmlokal-api npm run migrate
docker-compose exec farmlokal-api npm run seed
```

3. **Monitor logs**
```bash
docker-compose logs -f farmlokal-api
```

### Environment-Specific Configurations

**Development:**
- Detailed logging
- Hot reloading
- Debug endpoints enabled

**Production:**
- Optimized logging
- Security headers enforced
- Health checks enabled
- Graceful shutdown handling

## 🧪 Testing

### Load Testing
Use the included k6 script for load testing:

```bash
# Install k6
npm install -g k6

# Run load test
k6 run scripts/load-test.js
```

### API Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check MySQL service status
   - Verify connection parameters
   - Check network connectivity

2. **Redis Connection Issues**
   - Verify Redis service status
   - Check Redis configuration
   - Monitor memory usage

3. **Performance Issues**
   - Check database indexes
   - Monitor cache hit rates
   - Review query performance

### Debug Mode
```bash
DEBUG=farmlokal:* npm run dev
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Stateless application design
- Redis for shared state
- Load balancer configuration

### Database Scaling
- Read replicas for read-heavy workloads
- Database sharding for write scaling
- Connection pooling optimization

### Cache Scaling
- Redis clustering
- Cache warming strategies
- Distributed caching patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ for the farming community**