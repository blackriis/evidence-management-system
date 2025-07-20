import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1),

  // File Storage
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().default("us-east-1"),

  // Email Service
  RESEND_API_KEY: z.string().min(1).default("build-key"),
  FROM_EMAIL: z.string().email().default("noreply@localhost.com"),

  // Line Notify
  LINE_NOTIFY_TOKEN: z.string().min(1).default("build-token"),

  // Redis
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  // Skip validation during build if SKIP_ENV_VALIDATION is set
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    console.log('⚠️ Skipping environment validation for build');
    env = {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/db',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'build-time-secret',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
      STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY || 'build-key',
      STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY || 'build-secret',
      STORAGE_BUCKET: process.env.STORAGE_BUCKET || 'evidence-files',
      STORAGE_REGION: process.env.STORAGE_REGION || 'us-east-1',
      RESEND_API_KEY: process.env.RESEND_API_KEY || 'build-key',
      FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@localhost.com',
      LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN || 'build-token',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      APP_URL: process.env.APP_URL || 'http://localhost:3000',
    };
  } else {
    env = envSchema.parse(process.env);
  }
} catch (error) {
  console.error("❌ Invalid environment variables:", error);
  throw new Error("Invalid environment variables");
}

export { env };
