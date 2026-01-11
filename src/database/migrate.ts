import fs from 'fs';
import path from 'path';
import { database } from '@/config/database';
import { logger } from '@/utils/logger';

async function runMigrations(): Promise<void> {
  try {
    // Initialize database connection
    await database.initialize();
    const db = database.getPool();

    logger.info('Starting database migrations...');

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Split SQL statements (simple approach - in production, use a proper migration tool)
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        if (statement.trim()) {
          await db.execute(statement);
          logger.debug(`Executed: ${statement.substring(0, 50)}...`);
        }
      } catch (error: any) {
        // Ignore "table already exists" errors
        if (!error.message.includes('already exists')) {
          logger.error(`Failed to execute statement: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await database.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { runMigrations };