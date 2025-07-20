# Use Node.js 20 LTS
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat python3 make g++ wget
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

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate

# Set build-time environment variables
ENV SKIP_ENV_VALIDATION=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DISABLE_REDIS_CACHE=true
ENV HTTPS_ENABLED=false

# Create minimal environment for build
RUN echo 'DATABASE_URL="postgresql://user:pass@localhost:5432/db"' > .env.local && \
    echo 'NEXTAUTH_SECRET="build-time-secret-at-least-32-chars-long"' >> .env.local && \
    echo 'NEXTAUTH_URL="http://localhost:3000"' >> .env.local && \
    echo 'STORAGE_ENDPOINT="http://localhost:9000"' >> .env.local && \
    echo 'STORAGE_ACCESS_KEY="build-key"' >> .env.local && \
    echo 'STORAGE_SECRET_KEY="build-secret"' >> .env.local && \
    echo 'STORAGE_BUCKET="evidence-files"' >> .env.local && \
    echo 'STORAGE_REGION="us-east-1"' >> .env.local

# Build the application
RUN npm run build

# Clean up build environment
RUN rm -f .env.local

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

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
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]