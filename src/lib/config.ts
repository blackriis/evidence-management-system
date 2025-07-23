/**
 * Environment-specific Configuration Management
 * Centralizes all configuration with validation and type safety
 */

import { z } from 'zod';

// Configuration schema validation
const configSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']),
  APP_URL: z.string().default('http://localhost:3000'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string(),
  DATABASE_CONNECTION_LIMIT: z.coerce.number().default(10),
  DATABASE_CONNECT_TIMEOUT: z.coerce.number().default(60),
  DATABASE_POOL_TIMEOUT: z.coerce.number().default(60),
  DATABASE_STATEMENT_TIMEOUT: z.string().default('30s'),
  DATABASE_SSL_MODE: z.enum(['disable', 'require', 'verify-ca', 'verify-full']).optional(),

  // Authentication
  NEXTAUTH_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(32).optional(),

  // Storage
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().default('us-east-1'),

  // Backup Storage
  BACKUP_STORAGE_ENDPOINT: z.string().optional(),
  BACKUP_STORAGE_ACCESS_KEY: z.string().optional(),
  BACKUP_STORAGE_SECRET_KEY: z.string().optional(),
  BACKUP_STORAGE_BUCKET: z.string().optional(),
  BACKUP_STORAGE_REGION: z.string().optional(),

  // CDN
  CDN_DOMAIN: z.string().optional(),
  CDN_ENABLED: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.coerce.boolean().default(false),
  REDIS_MAX_CONNECTIONS: z.coerce.number().default(10),

  // Email
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().default('noreply@localhost.com'),
  SUPPORT_EMAIL: z.string().email().optional(),

  // Line Notify
  LINE_NOTIFY_TOKEN: z.string().optional(),

  // Security
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  SESSION_MAX_AGE: z.coerce.number().default(86400),
  CSRF_SECRET: z.string().min(32).optional(),

  // Monitoring
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_PERFORMANCE_MONITORING: z.coerce.boolean().default(false),
  ENABLE_AUDIT_LOGGING: z.coerce.boolean().default(true),
  SENTRY_DSN: z.string().optional(),

  // File Upload
  MAX_FILE_SIZE: z.coerce.number().default(104857600), // 100MB
  MAX_FILES_PER_USER_PER_YEAR: z.coerce.number().default(5368709120), // 5GB
  ALLOWED_FILE_TYPES: z.string().default('pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,txt,zip,rar'),

  // Backup
  BACKUP_ENABLED: z.coerce.boolean().default(false),
  BACKUP_SCHEDULE: z.string().default('0 2 * * *'),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(2555), // ~7 years
  BACKUP_VERIFICATION: z.coerce.boolean().default(true),

  // SSL/TLS
  HTTPS_ENABLED: z.coerce.boolean().default(false),
  SSL_CERT_PATH: z.string().optional(),
  SSL_KEY_PATH: z.string().optional(),
  SSL_CA_PATH: z.string().optional(),

  // Geographic
  PRIMARY_REGION: z.string().default('us-east-1'),
  BACKUP_REGION_1: z.string().optional(),
  BACKUP_REGION_2: z.string().optional(),

  // Performance
  CACHE_TTL: z.coerce.number().default(3600),
  API_TIMEOUT: z.coerce.number().default(30000),
  UPLOAD_TIMEOUT: z.coerce.number().default(300000),
  MAX_CONCURRENT_UPLOADS: z.coerce.number().default(10),

  // Compliance
  AUDIT_RETENTION_YEARS: z.coerce.number().default(7),
  DATA_RETENTION_YEARS: z.coerce.number().default(7),
  ENCRYPTION_KEY_ROTATION_DAYS: z.coerce.number().default(90),

  // Health Check
  HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
  HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),

  // Feature Flags
  ENABLE_VIRUS_SCANNING: z.coerce.boolean().default(false),
  ENABLE_FILE_VERSIONING: z.coerce.boolean().default(true),
  ENABLE_AUTOMATIC_BACKUPS: z.coerce.boolean().default(false),
  ENABLE_PERFORMANCE_METRICS: z.coerce.boolean().default(false),
  ENABLE_SECURITY_HEADERS: z.coerce.boolean().default(true),
});

// Parse and validate environment variables
function parseConfig() {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment configuration:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    
    // In production, try to continue with fallback values
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Using fallback configuration values for production');
      return {
        NODE_ENV: process.env.NODE_ENV || 'production',
        APP_URL: process.env.APP_URL || 'http://localhost:3000',
        PORT: parseInt(process.env.PORT || '3000'),
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/db',
        DATABASE_CONNECTION_LIMIT: 10,
        DATABASE_CONNECT_TIMEOUT: 60,
        DATABASE_POOL_TIMEOUT: 60,
        DATABASE_STATEMENT_TIMEOUT: '30s',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'fallback-secret-at-least-32-chars-long',
        STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
        STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
        STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
        STORAGE_BUCKET: process.env.STORAGE_BUCKET,
        STORAGE_REGION: process.env.STORAGE_REGION || 'us-east-1',
        REDIS_URL: process.env.REDIS_URL,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        REDIS_TLS: false,
        REDIS_MAX_CONNECTIONS: 10,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@localhost.com',
        RATE_LIMIT_MAX: 100,
        RATE_LIMIT_WINDOW_MS: 900000,
        BCRYPT_ROUNDS: 12,
        SESSION_MAX_AGE: 86400,
        LOG_LEVEL: 'info',
        ENABLE_PERFORMANCE_MONITORING: false,
        ENABLE_AUDIT_LOGGING: true,
        MAX_FILE_SIZE: 104857600,
        MAX_FILES_PER_USER_PER_YEAR: 5368709120,
        ALLOWED_FILE_TYPES: 'pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,txt,zip,rar',
        BACKUP_ENABLED: false,
        BACKUP_SCHEDULE: '0 2 * * *',
        BACKUP_RETENTION_DAYS: 2555,
        BACKUP_VERIFICATION: true,
        HTTPS_ENABLED: false,
        PRIMARY_REGION: 'us-east-1',
        CACHE_TTL: 3600,
        API_TIMEOUT: 30000,
        UPLOAD_TIMEOUT: 300000,
        MAX_CONCURRENT_UPLOADS: 10,
        AUDIT_RETENTION_YEARS: 7,
        DATA_RETENTION_YEARS: 7,
        ENCRYPTION_KEY_ROTATION_DAYS: 90,
        HEALTH_CHECK_ENABLED: true,
        HEALTH_CHECK_INTERVAL: 30000,
        HEALTH_CHECK_TIMEOUT: 5000,
        ENABLE_VIRUS_SCANNING: false,
        ENABLE_FILE_VERSIONING: true,
        ENABLE_AUTOMATIC_BACKUPS: false,
        ENABLE_PERFORMANCE_METRICS: false,
        ENABLE_SECURITY_HEADERS: true,
      } as any;
    }
    
    process.exit(1);
  }
}

// Export validated configuration
export const config = parseConfig();

// Environment-specific configurations
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Database configuration
export const databaseConfig = {
  url: config.DATABASE_URL,
  connectionLimit: config.DATABASE_CONNECTION_LIMIT,
  connectTimeout: config.DATABASE_CONNECT_TIMEOUT,
  poolTimeout: config.DATABASE_POOL_TIMEOUT,
  statementTimeout: config.DATABASE_STATEMENT_TIMEOUT,
  ssl: config.DATABASE_SSL_MODE ? {
    mode: config.DATABASE_SSL_MODE,
    cert: process.env.DATABASE_SSL_CERT_PATH,
    key: process.env.DATABASE_SSL_KEY_PATH,
    ca: process.env.DATABASE_SSL_CA_PATH,
  } : undefined,
};

// Storage configuration
export const storageConfig = {
  primary: config.STORAGE_ENDPOINT ? {
    endpoint: config.STORAGE_ENDPOINT,
    accessKey: config.STORAGE_ACCESS_KEY!,
    secretKey: config.STORAGE_SECRET_KEY!,
    bucket: config.STORAGE_BUCKET!,
    region: config.STORAGE_REGION,
  } : undefined,
  backup: config.BACKUP_STORAGE_ENDPOINT ? {
    endpoint: config.BACKUP_STORAGE_ENDPOINT,
    accessKey: config.BACKUP_STORAGE_ACCESS_KEY!,
    secretKey: config.BACKUP_STORAGE_SECRET_KEY!,
    bucket: config.BACKUP_STORAGE_BUCKET!,
    region: config.BACKUP_STORAGE_REGION!,
  } : undefined,
  cdn: config.CDN_ENABLED ? {
    domain: config.CDN_DOMAIN!,
    enabled: config.CDN_ENABLED,
  } : undefined,
};

// Redis configuration
export const redisConfig = config.REDIS_URL ? {
  url: config.REDIS_URL,
  password: config.REDIS_PASSWORD,
  tls: config.REDIS_TLS,
  maxConnections: config.REDIS_MAX_CONNECTIONS,
} : undefined;

// Security configuration
export const securityConfig = {
  rateLimit: {
    max: config.RATE_LIMIT_MAX,
    windowMs: config.RATE_LIMIT_WINDOW_MS,
  },
  bcryptRounds: config.BCRYPT_ROUNDS,
  sessionMaxAge: config.SESSION_MAX_AGE,
  csrfSecret: config.CSRF_SECRET,
  httpsEnabled: config.HTTPS_ENABLED,
  ssl: config.HTTPS_ENABLED ? {
    cert: config.SSL_CERT_PATH,
    key: config.SSL_KEY_PATH,
    ca: config.SSL_CA_PATH,
  } : undefined,
};

// File upload configuration
export const uploadConfig = {
  maxFileSize: config.MAX_FILE_SIZE,
  maxFilesPerUserPerYear: config.MAX_FILES_PER_USER_PER_YEAR,
  allowedFileTypes: config.ALLOWED_FILE_TYPES.split(','),
  maxConcurrentUploads: config.MAX_CONCURRENT_UPLOADS,
  timeout: config.UPLOAD_TIMEOUT,
};

// Backup configuration
export const backupConfig = {
  enabled: config.BACKUP_ENABLED,
  schedule: config.BACKUP_SCHEDULE,
  retentionDays: config.BACKUP_RETENTION_DAYS,
  verification: config.BACKUP_VERIFICATION,
};

// Monitoring configuration
export const monitoringConfig = {
  logLevel: config.LOG_LEVEL,
  performanceMonitoring: config.ENABLE_PERFORMANCE_MONITORING,
  auditLogging: config.ENABLE_AUDIT_LOGGING,
  sentryDsn: config.SENTRY_DSN,
  healthCheck: {
    enabled: config.HEALTH_CHECK_ENABLED,
    interval: config.HEALTH_CHECK_INTERVAL,
    timeout: config.HEALTH_CHECK_TIMEOUT,
  },
};

// Feature flags
export const featureFlags = {
  virusScanning: config.ENABLE_VIRUS_SCANNING,
  fileVersioning: config.ENABLE_FILE_VERSIONING,
  automaticBackups: config.ENABLE_AUTOMATIC_BACKUPS,
  performanceMetrics: config.ENABLE_PERFORMANCE_METRICS,
  securityHeaders: config.ENABLE_SECURITY_HEADERS,
};

// Compliance configuration
export const complianceConfig = {
  auditRetentionYears: config.AUDIT_RETENTION_YEARS,
  dataRetentionYears: config.DATA_RETENTION_YEARS,
  encryptionKeyRotationDays: config.ENCRYPTION_KEY_ROTATION_DAYS,
};

// Geographic configuration
export const geoConfig = {
  primaryRegion: config.PRIMARY_REGION,
  backupRegions: [config.BACKUP_REGION_1, config.BACKUP_REGION_2].filter(Boolean),
};

// Performance configuration
export const performanceConfig = {
  cacheTtl: config.CACHE_TTL,
  apiTimeout: config.API_TIMEOUT,
  uploadTimeout: config.UPLOAD_TIMEOUT,
  maxConcurrentUploads: config.MAX_CONCURRENT_UPLOADS,
};

// Validation helper functions
export function validateConfig() {
  const errors: string[] = [];

  // Check required production settings
  if (isProduction) {
    if (!config.HTTPS_ENABLED) {
      errors.push('HTTPS must be enabled in production');
    }
    if (config.NEXTAUTH_SECRET.length < 32) {
      errors.push('NEXTAUTH_SECRET must be at least 32 characters in production');
    }
    if (!config.BACKUP_ENABLED) {
      console.warn('⚠️  Backups are disabled in production');
    }
    if (!config.ENABLE_PERFORMANCE_MONITORING) {
      console.warn('⚠️  Performance monitoring is disabled in production');
    }
  }

  if (errors.length > 0) {
    console.error('❌ Production configuration errors:');
    errors.forEach(error => console.error(`  ${error}`));
    process.exit(1);
  }

  console.log('✅ Configuration validated successfully');
}

// Export type for TypeScript
export type Config = z.infer<typeof configSchema>;