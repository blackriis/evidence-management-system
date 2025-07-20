import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Database connection pool configuration
const connectionPoolConfig = {
  // Connection pool size
  connection_limit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || "10"),
  // Connection timeout
  connect_timeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || "60"),
  // Pool timeout
  pool_timeout: parseInt(process.env.DATABASE_POOL_TIMEOUT || "60"),
  // Statement timeout
  statement_timeout: process.env.DATABASE_STATEMENT_TIMEOUT || "30s",
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL + 
             `?connection_limit=${connectionPoolConfig.connection_limit}` +
             `&connect_timeout=${connectionPoolConfig.connect_timeout}` +
             `&pool_timeout=${connectionPoolConfig.pool_timeout}` +
             `&statement_timeout=${connectionPoolConfig.statement_timeout}`,
      },
    },
    // Query optimization settings
    errorFormat: 'minimal',
    transactionOptions: {
      maxWait: 5000, // 5 seconds
      timeout: 10000, // 10 seconds
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Database metrics for monitoring
export async function getDatabaseMetrics() {
  try {
    const [connectionInfo] = await db.$queryRaw<Array<{
      total_connections: number;
      active_connections: number;
      idle_connections: number;
    }>>`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections
    `;

    return connectionInfo;
  } catch (error) {
    console.error('Failed to get database metrics:', error);
    return null;
  }
}

// Optimized query helpers
export const dbHelpers = {
  // Batch operations helper
  async batchOperation<T>(
    operations: Array<() => Promise<T>>,
    batchSize: number = 10
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    return results;
  },

  // Transaction wrapper with retry logic
  async withTransaction<T>(
    operation: (tx: any) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await db.$transaction(operation, {
          maxWait: 5000,
          timeout: 10000,
        });
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof Error && 
            (error.message.includes('Unique constraint') || 
             error.message.includes('Foreign key constraint'))) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
    
    throw lastError!;
  },
};
