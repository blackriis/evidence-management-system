# Use Node.js 20 LTS
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production --no-audit --no-fund

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev dependencies for build)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .

# Set build-time environment variables
ENV SKIP_ENV_VALIDATION=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DISABLE_REDIS_CACHE=true
ENV HTTPS_ENABLED=false

# Create complete environment for build
RUN echo 'DATABASE_URL="postgresql://user:pass@localhost:5432/db"' > .env.local && \
    echo 'NEXTAUTH_SECRET="build-time-secret-at-least-32-chars-long"' >> .env.local && \
    echo 'NEXTAUTH_URL="http://localhost:3000"' >> .env.local && \
    echo 'STORAGE_ENDPOINT="http://localhost:9000"' >> .env.local && \
    echo 'STORAGE_ACCESS_KEY="build-key"' >> .env.local && \
    echo 'STORAGE_SECRET_KEY="build-secret"' >> .env.local && \
    echo 'STORAGE_BUCKET="evidence-files"' >> .env.local && \
    echo 'STORAGE_REGION="us-east-1"' >> .env.local && \
    echo 'APP_URL="http://localhost:3000"' >> .env.local && \
    echo 'REDIS_URL="redis://localhost:6379"' >> .env.local && \
    echo 'RESEND_API_KEY="build-key"' >> .env.local && \
    echo 'FROM_EMAIL="noreply@localhost.com"' >> .env.local && \
    echo 'LINE_NOTIFY_TOKEN="build-token"' >> .env.local

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Clean up build environment
RUN rm -f .env.local

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install npm for database operations and wget for health checks
RUN apk add --no-cache npm wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create uploads directory
RUN mkdir -p /app/uploads/evidence
RUN chown nextjs:nodejs /app/uploads

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check with longer start period for application initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Simple startup
CMD ["node", "server.js"]