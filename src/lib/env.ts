import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),

  // NextAuth
  NEXTAUTH_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1),

  // File Storage - all optional for deployment flexibility
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().default("us-east-1"),

  // Email Service - optional
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default("noreply@localhost.com"),

  // Line Notify - optional
  LINE_NOTIFY_TOKEN: z.string().optional(),

  // Redis - optional
  REDIS_URL: z.string().optional(),

  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  console.log('🔧 Loading environment configuration...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('SKIP_ENV_VALIDATION:', process.env.SKIP_ENV_VALIDATION);
  console.log('Has STORAGE_ENDPOINT:', !!process.env.STORAGE_ENDPOINT);
  console.log('Has REDIS_URL:', !!process.env.REDIS_URL);
  console.log('Has RESEND_API_KEY:', !!process.env.RESEND_API_KEY);
  
  env = envSchema.parse(process.env);
  console.log('✅ Environment validation passed');
} catch (error) {
  console.error("❌ Environment validation failed:", error);
  console.log('⚠️ Using fallback environment values');
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
}

export { env };
