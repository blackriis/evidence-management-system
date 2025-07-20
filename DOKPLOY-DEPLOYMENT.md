# Dokploy Deployment Guide

9H!7-2# deploy Evidence Management System H2 Dokploy

## Prerequisites

1. **Dokploy Server**: Server 5H41I Dokploy A%I'
2. **Domain**: Domain name *3+#1 application (@
H evidence.yourdomain.com)
3. **Database**: PostgreSQL database (*2!2#C
I Dokploy managed database +#7- external database)
4. **Git Repository**: Source code -"9HC Git repository

## Step 1: @#5"! Database

### Option A: C
I Dokploy Managed PostgreSQL
1. C Dokploy Dashboard, D5H **Services** > **Add Service** > **PostgreSQL**
2. 1IH2:
   - **Name**: `evidence-db`
   - **Database Name**: `evidence_management`
   - **Username**: `evidence_user`
   - **Password**: *#I2 strong password
   - **Version**: `16` (+#7-C+!H'H2)
3. Click **Create**

### Option B: C
I External Database
- @#5"! PostgreSQL database connection string
- Format: `postgresql://username:password@host:port/database`

## Step 2: *#I2 Application C Dokploy

1. C Dokploy Dashboard, D5H **Applications** > **Add Application**
2. @%7- **Git Repository**
3. 1IH2:
   - **Name**: `evidence-management-system`
   - **Repository URL**: URL - Git repository
   - **Branch**: `main` (+#7- branch 5HI-2# deploy)
   - **Build Path**: `/` (root directory)

## Step 3: Configure Environment Variables

C Application Settings > **Environment Variables**, @4H! variables H-D5I:

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://evidence_user:your_password@evidence-db:5432/evidence_management

# Authentication
NEXTAUTH_SECRET=your-super-secret-jwt-secret-key-minimum-32-characters
NEXTAUTH_URL=https://evidence.yourdomain.com

# File Storage (C
I local storage)
STORAGE_ENDPOINT=local
STORAGE_ACCESS_KEY=local
STORAGE_SECRET_KEY=local
STORAGE_BUCKET=evidence-files
STORAGE_REGION=local

# Environment
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### Optional Variables (*3+#1 features @4H!@4!)

```bash
# Email Notifications
RESEND_API_KEY=your-resend-api-key
FROM_EMAIL=noreply@yourdomain.com

# Line Notify
LINE_NOTIFY_TOKEN=your-line-notify-token

# Redis (*3+#1 caching)
REDIS_URL=redis://redis:6379

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
LOG_LEVEL=info
```

## Step 4: Configure Dockerfile Build

1. C Application Settings > **Build**, 1IH2:
   - **Build Type**: `Dockerfile`
   - **Dockerfile Path**: `Dockerfile`
   - **Build Context**: `/`

## Step 5: Configure Domain

1. C Application Settings > **Domains**
2. @4H! domain:
   - **Domain**: `evidence.yourdomain.com`
   - **SSL**: @4C
I2 SSL certificate (Let's Encrypt)
   - **Port**: `3000`

## Step 6: Configure Health Check

1. C Application Settings > **Health Check**
2. 1IH2:
   - **Health Check Path**: `/api/health`
   - **Health Check Interval**: `30s`
   - **Health Check Timeout**: `30s`
   - **Health Check Retries**: `3`

## Step 7: Configure Volumes (*3+#1 persistent storage)

1. C Application Settings > **Volumes**
2. @4H! volume:
   - **Host Path**: `/var/dokploy/evidence/uploads`
   - **Container Path**: `/app/uploads`
   - **Type**: `bind`

## Step 8: Deploy Application

1. Click **Deploy** button
2. #-C+I build A%0 deployment @*#G*4I
3. #'*- logs C **Logs** tab

## Step 9: Initialize Database

+%12 deploy *3@#G, I- initialize database:

1. C Application > **Terminal** +#7- SSH @I2DC container
2. #1 commands:

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

## Step 10: Verify Deployment

1. @I2D5H `https://evidence.yourdomain.com`
2. #'*- health check: `https://evidence.yourdomain.com/api/health`
3. *- login I'" default admin account:
   - Email: `admin@example.com`
   - Password: `admin123`

## Post-Deployment Configuration

### Security Recommendations

1. **Change Default Passwords**: @%5H" password - admin account
2. **SSL Certificate**: #'*-'H2 SSL certificate C
I2DI
3. **Firewall**: 31 access D"1 database A%0 internal services
4. **Backup**: 1IH2 automated backup

### Monitoring Setup

1. #'*- application logs C Dokploy dashboard
2. Monitor resource usage (CPU, Memory, Disk)
3. 1IH2 alerts *3+#1 downtime +#7- errors

### Performance Optimization

1. **Redis Cache**: @4H! Redis service *3+#1 caching
2. **CDN**: C
I CDN *3+#1 static assets
3. **Database Optimization**: optimize database queries A%0 indexes

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - #'*- DATABASE_URL
   - #'*-'H2 database service running
   - #'*- network connectivity

2. **Build Failed**
   - #'*- Dockerfile syntax
   - #'*- dependencies C package.json
   - #'*- build logs

3. **Health Check Failed**
   - #'*-'H2 `/api/health` endpoint accessible
   - #'*- application logs
   - #'*- environment variables

4. **File Upload Issues**
   - #'*- volume mounting
   - #'*- file permissions
   - #'*- storage configuration

### Logs A%0 Debugging

```bash
# 9 application logs
docker logs <container_id>

# @I2DC container
docker exec -it <container_id> /bin/sh

# #'*- database connection
npx prisma db pull --preview-feature
```

## Backup A%0 Recovery

### Database Backup

```bash
# Manual backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### File Backup

```bash
# Backup uploaded files
tar -czf uploads-backup.tar.gz /var/dokploy/evidence/uploads
```

## Scaling

### Horizontal Scaling
- @4H! replica - application
- C
I load balancer
- Share storage #0+'H2 instances

### Vertical Scaling
- @4H! CPU A%0 RAM C Dokploy settings
- Optimize database resources

## Updates A%0 Maintenance

1. **Code Updates**: Push D"1 Git repository A%0 redeploy
2. **Database Updates**: C
I Prisma migrations
3. **Security Updates**: -1@ dependencies @G#03
4. **Monitoring**: #'*- performance A%0 errors

---

## Support

+2!51+2C2# deployment:

1. #'*- Dokploy documentation
2. #'*- application logs
3. #'*- issue C GitHub repository