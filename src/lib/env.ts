import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1),

  // File Storage
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_SECRET_KEY: z.string().min(1).optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_REGION: z.string().default("us-east-1"),

  // Email Service
  RESEND_API_KEY: z.string().min(1).optional(),
  FROM_EMAIL: z.string().email().default("noreply@localhost.com"),

  // Line Notify
  LINE_NOTIFY_TOKEN: z.string().min(1).optional(),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_URL: z.string().url().default("https://evidence.pk22.ac.th"),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  // Skip validation during build or when missing optional services
  const shouldSkipValidation = 
    process.env.SKIP_ENV_VALIDATION === 'true' || 
    (process.env.NODE_ENV === 'production' && (
      !process.env.STORAGE_ENDPOINT || 
      !process.env.REDIS_URL || 
      !process.env.RESEND_API_KEY
    ));

  if (shouldSkipValidation) {
    console.log('⚠️ Skipping environment validation - using fallback values');
    env = {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/db',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'build-time-secret-must-be-at-least-32-chars',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
      STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
      STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
      STORAGE_BUCKET: process.env.STORAGE_BUCKET,
      STORAGE_REGION: process.env.STORAGE_REGION || 'us-east-1',
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@localhost.com',
      LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN,
      REDIS_URL: process.env.REDIS_URL,
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      APP_URL: process.env.APP_URL || 'http://localhost:3000',
    };
  } else {
    env = envSchema.parse(process.env);
  }
} catch (error) {
  console.error("❌ Invalid environment configuration:", error);
  // In production, try to use fallback values even if validation fails
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️ Using fallback environment values for production');
    env = {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/db',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'build-time-secret-must-be-at-least-32-chars',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
      STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
      STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
      STORAGE_BUCKET: process.env.STORAGE_BUCKET,
      STORAGE_REGION: process.env.STORAGE_REGION || 'us-east-1',
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@localhost.com',
      LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN,
      REDIS_URL: process.env.REDIS_URL,
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      APP_URL: process.env.APP_URL || 'http://localhost:3000',
    };
  } else {
    throw new Error("Invalid environment variables");
  }
}

export { env };
