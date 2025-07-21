# Coolify Deployment Guide - Evidence Management System

## 1. Server Prerequisites

### System Requirements
- **OS**: Ubuntu 22.04 LTS (recommended)
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum
- **CPU**: 2 cores minimum
- **Network**: Public IP with ports 80, 443, 8000 accessible

### Install Coolify
```bash
# Run as root
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Or use our custom script:
```bash
curl -fsSL https://raw.githubusercontent.com/blackriis/evidence-management-system/main/deploy/coolify-install.sh | bash
```

## 2. Initial Coolify Setup

### Access Coolify Dashboard
1. เข้า `http://your-server-ip:8000`
2. สร้าง admin account
3. Complete registration และ email verification
4. Configure server settings

### Configure Server
1. **Server Settings**:
   - Server Name: `Evidence Production Server`
   - IP Address: จะ detect อัตโนมัติ
   - SSH Key: Upload หรือ generate ใหม่

2. **Domain Settings** (Optional):
   - Primary Domain: your-domain.com
   - Wildcard SSL: Enable

## 3. GitHub Integration

### Connect GitHub Repository
1. **Settings** → **GitHub Integration**
2. **Connect GitHub Account**
3. **Authorize Coolify** access to repositories
4. **Select Repository**: `blackriis/evidence-management-system`

### Deploy Token (if needed)
```bash
# Generate GitHub Personal Access Token with repo access
# Add to Coolify: Settings → GitHub → Personal Access Token
```

## 4. Database Service Setup

### Create PostgreSQL Service
1. **Services** → **Add Service**
2. **Database Type**: PostgreSQL 15
3. **Configuration**:
   ```
   Service Name: evidence-postgres
   Database Name: evidence_management
   Username: evidenceuser
   Password: [generate strong password]
   Port: 5432 (internal)
   Volume: ./postgres-data:/var/lib/postgresql/data
   ```

4. **Deploy Database Service**
5. **Wait for deployment** (status: Running)

### Database Connection String
```
DATABASE_URL="postgresql://evidenceuser:password@evidence-postgres:5432/evidence_management"
```

## 5. Application Deployment

### Create New Application
1. **Applications** → **Add Application**
2. **Source Type**: Git Repository
3. **Repository**: `https://github.com/blackriis/evidence-management-system`
4. **Branch**: `main`
5. **Build Pack**: Docker (auto-detected)

### Application Configuration
```yaml
Name: evidence-management-system
Build Command: npm run build
Start Command: npm start
Port: 3000
Health Check: /api/health
```

### Environment Variables
Add ใน **Environment** tab:

```bash
# Database
DATABASE_URL=postgresql://evidenceuser:your_password@evidence-postgres:5432/evidence_management

# NextAuth
NEXTAUTH_SECRET=your-32-character-secret-key-minimum-length-required
NEXTAUTH_URL=https://your-domain.com

# File Storage (S3 compatible)
STORAGE_ENDPOINT=https://s3.amazonaws.com
STORAGE_ACCESS_KEY=your_s3_access_key
STORAGE_SECRET_KEY=your_s3_secret_key
STORAGE_BUCKET=evidence-files
STORAGE_REGION=us-east-1

# Email Service
RESEND_API_KEY=re_your_resend_api_key
FROM_EMAIL=noreply@your-domain.com

# Optional Services
LINE_NOTIFY_TOKEN=your_line_notify_token
REDIS_URL=redis://evidence-redis:6379

# Application Settings
NODE_ENV=production
APP_URL=https://your-domain.com
PORT=3000
HOSTNAME=0.0.0.0
```

### Build Settings
```dockerfile
# Coolify will use our existing Dockerfile
# Ensure PORT environment variable is set to 3000
```

## 6. Domain & SSL Configuration

### Add Custom Domain
1. **Domains** tab ใน application
2. **Add Domain**: your-domain.com
3. **SSL Certificate**: 
   - **Let's Encrypt** (automatic)
   - หรือ **Custom Certificate**

### DNS Configuration
Point your domain to server IP:
```
A Record: your-domain.com → your-server-ip
CNAME: www.your-domain.com → your-domain.com
```

### Wildcard SSL (Optional)
```
*.your-domain.com → your-server-ip
```

## 7. Redis Cache (Optional)

### Add Redis Service
1. **Services** → **Add Service** 
2. **Type**: Redis 7
3. **Configuration**:
   ```
   Service Name: evidence-redis
   Port: 6379
   Volume: ./redis-data:/data
   Memory Limit: 256MB
   ```

## 8. Database Migration & Seeding

### One-time Setup Commands
```bash
# Connect to application container
docker exec -it [app-container-name] bash

# Run database migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed

# Generate Prisma client (if needed)
npx prisma generate
```

### Using Coolify Execute Command
1. **Application** → **Execute**
2. Run commands:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

## 9. Deployment Workflow

### Automatic Deployment
Coolify รองรับ auto-deployment on git push:

1. **Settings** → **Auto Deploy**
2. **Enable Auto Deploy on Push**
3. **Branch**: main
4. **Build on Push**: ✅

### Manual Deployment
1. **Deploy** tab
2. **Deploy Latest**
3. Monitor build logs
4. Check deployment status

### Build Process
```bash
# Coolify จะ run ตาม Dockerfile:
1. Install dependencies
2. Build application  
3. Generate Prisma client
4. Start production server
```

## 10. Monitoring & Logs

### Application Logs
1. **Logs** tab ใน application
2. **Real-time logs** streaming
3. **Download logs** for analysis

### Resource Monitoring
1. **Metrics** tab
2. **CPU, Memory, Network usage**
3. **Container statistics**

### Health Checks
```bash
# Coolify จะ monitor:
HTTP: https://your-domain.com/api/health
Response: {"ok": true}
```

## 11. Backup Strategy

### Database Backups
```bash
# Automated backup script
docker exec evidence-postgres pg_dump -U evidenceuser evidence_management > backup_$(date +%Y%m%d).sql
```

### Application Backups
- **Git repository**: Source code backup
- **Environment variables**: Export from Coolify
- **Uploaded files**: S3 bucket backup

## 12. Security Configuration

### Firewall Settings
```bash
# UFW firewall rules
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 8000/tcp # Coolify (restrict to admin IP)
ufw enable
```

### SSL Security
Coolify automatically configures:
- **TLS 1.2/1.3** only
- **HSTS headers**
- **Secure ciphers**
- **Certificate auto-renewal**

## 13. Performance Optimization

### Container Resources
```yaml
# Application limits
CPU: 1.0 cores
Memory: 1GB
Swap: 512MB

# Database limits  
CPU: 0.5 cores
Memory: 512MB
```

### CDN Integration (Optional)
Configure CDN สำหรับ static assets:
- **Cloudflare**
- **AWS CloudFront**
- **StackPath**

## 14. Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs in Coolify dashboard
# Common fixes:
1. Node.js version mismatch
2. Environment variables missing
3. Database connection timeout
```

#### Runtime Issues  
```bash
# Application logs show:
1. Port binding errors
2. Database connection issues
3. Missing environment variables
```

#### Database Connection
```bash
# Test database connectivity
docker exec -it evidence-postgres psql -U evidenceuser -d evidence_management -c "SELECT 1;"
```

### Log Locations
- **Application logs**: Coolify dashboard
- **System logs**: `/var/log/coolify/`
- **Docker logs**: `docker logs [container-name]`

## 15. Scaling & High Availability

### Horizontal Scaling
```yaml
# Multiple application instances
Instances: 2-4
Load Balancer: Automatic (Traefik)
Session Store: Redis (sticky sessions)
```

### Database Scaling
- **Read Replicas**: PostgreSQL streaming replication
- **Connection Pooling**: PgBouncer
- **Backup Strategy**: Point-in-time recovery

## 16. Production Checklist

### Pre-deployment
- [ ] Server resources adequate
- [ ] Domain DNS configured  
- [ ] SSL certificate ready
- [ ] Environment variables set
- [ ] Database service running
- [ ] S3 bucket configured

### Post-deployment
- [ ] Health check passing
- [ ] Database migrations applied
- [ ] Admin user created
- [ ] File uploads working
- [ ] Email notifications working
- [ ] SSL certificate valid
- [ ] Monitoring alerts configured

## Advantages of Coolify

✅ **Git Integration** - Auto-deploy on push  
✅ **Docker Native** - Uses existing Dockerfile  
✅ **SSL Management** - Let's Encrypt integration  
✅ **Database Services** - PostgreSQL, Redis built-in  
✅ **Monitoring** - Built-in logs and metrics  
✅ **Scaling** - Easy horizontal scaling  
✅ **Backup** - Automated backup solutions  
✅ **Open Source** - Self-hosted, no vendor lock-in  

## Support & Resources

- **Coolify Docs**: https://coolify.io/docs
- **Discord**: https://discord.gg/coolify
- **GitHub**: https://github.com/coollabsio/coolify