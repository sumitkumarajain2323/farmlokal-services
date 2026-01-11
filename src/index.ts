import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { database } from './config/database';
import { redis } from './config/redis';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { 
  corsOptions, 
  helmetOptions, 
  compressionOptions,
  requestLogger,
  requestId,
  securityHeaders 
} from './middlewares/security';
import { generalRateLimiter } from './middlewares/rate-limiter';
import routes from './routes';
import config from './config';

class FarmLokalServer {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddlewares(): void {
    // Security middlewares
    this.app.use(helmet(helmetOptions));
    this.app.use(cors(corsOptions));
    this.app.use(securityHeaders);
    this.app.use(requestId);
    
    // Compression
    this.app.use(compression(compressionOptions));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use(requestLogger);
    
    // Rate limiting
    this.app.use(generalRateLimiter.middleware());
    
    // Trust proxy (important for rate limiting and IP detection)
    this.app.set('trust proxy', 1);
  }

  private setupRoutes(): void {
    // Health check endpoint (before rate limiting)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: config.API_VERSION,
      });
    });

    // API routes
    this.app.use(`/api/${config.API_VERSION}`, routes);
    
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'FarmLokal Backend API',
        version: config.API_VERSION,
        environment: config.NODE_ENV,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          api: `/api/${config.API_VERSION}`,
          docs: `/api/${config.API_VERSION}`,
        },
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing FarmLokal Backend...');
      
      // Initialize database connection
      await database.initialize();
      console.log('Database connection established');
      
      // Initialize Redis connection (non-blocking)
      redis.getClient().catch(() => console.warn('Redis unavailable, continuing without cache'));
      
      console.log('FarmLokal Backend initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FarmLokal Backend:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      await this.initialize();
      
      this.server = this.app.listen(config.PORT, () => {
        console.log(`🚀 FarmLokal Backend started successfully!`);
        console.log(`📍 Server running on port ${config.PORT}`);
        console.log(`🌍 Environment: ${config.NODE_ENV}`);
        console.log(`📊 API Version: ${config.API_VERSION}`);
        console.log(`🔗 Health Check: http://localhost:${config.PORT}/health`);
        console.log(`📚 API Docs: http://localhost:${config.PORT}/api/${config.API_VERSION}`);
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${config.PORT} is already in use`);
        } else {
          console.error('Server error:', error);
        }
        process.exit(1);
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    console.log('Shutting down FarmLokal Backend...');
    
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          console.log('HTTP server closed');
          resolve();
        });
      });
    }
    
    // Close database connections
    await database.close();
    await redis.close();
    
    console.log('FarmLokal Backend shut down complete');
  }
}

// Create server instance
const server = new FarmLokalServer();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await server.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  server.start().catch((error) => {
    console.error('Failed to start FarmLokal Backend:', error);
    process.exit(1);
  });
}

export default server;