import mysql from 'mysql2/promise';
import { logger } from '@/utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
  reconnect: boolean;
}

export const databaseConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'farmlokal',
  password: process.env.DB_PASSWORD || 'farmlokal123',
  database: process.env.DB_NAME || 'farmlokal_db',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
};

class DatabaseConnection {
  private pool: mysql.Pool | null = null;

  async initialize(): Promise<void> {
    try {
      this.pool = mysql.createPool({
        ...databaseConfig,
        waitForConnections: true,
        queueLimit: 0,
        charset: 'utf8mb4',
        timezone: '+00:00',
        supportBigNumbers: true,
        bigNumberStrings: true,
      });

      // Test connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      
      logger.info('Database connection pool initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  getPool(): mysql.Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection pool closed');
    }
  }
}

export const database = new DatabaseConnection();