# 🚀 Production Deployment Guide - PK22
Evidence Management System

## 📋 Environment Configuration

### Required Environment Variables
```bash
APP_URL=https://evidence.pk22.ac.th
DATABASE_URL=postgresql://evidence_user:Blackriis1122@d8scko4o4484kooccckg0kww:5432/postgres
NEXTAUTH_SECRET=build-secret-at-least-32-characters-long-for-jwt-signing
NEXTAUTH_URL=https://evidence.pk22.ac.th
NEXT_TELEMETRY_DISABLED=1
NODE_ENV=production
```

## 🔧 Pre-Deployment Steps

### 1. Database Setup
```bash
# Test database connection
npx prisma db push --accept-data-loss

# Run migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

### 2. Build Application
```bash
# Install dependencies
npm ci --only=production

# Generate Prisma client
npx prisma generate

# Build application
npm run build
```

### 3. Create Production User
```bash
# Set password for admin user
npx tsx -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupAdmin() {
  const hashedPassword = await bcrypt.hash('YourSecurePassword123!', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pk22.ac.th' },
    update: { password: hashedPassword },
    create: {
      email: 'admin@pk22.ac.th',
      name: 'PK22 System Administrator',
      role: 'ADMIN',
      password: hashedPassword,
      isActive: true
    }
  });
  
  console.log('✅ Admin user created:', admin.email);
  await prisma.\$disconnect();
}

setupAdmin();
"
```

## 🚀 Deployment Options

### Option 1: Manual Deployment
```bash
# Set production environment
export NODE_ENV=production

# Start application
npm start
```

### Option 2: Docker Deployment
```bash
# Build Docker image
docker build -t evidence-management-pk22 .

# Run container
docker run -d \
  --name evidence-management \
  --env-file .env.production \
  -p 3000:3000 \
  -v /var/evidence/uploads:/app/uploads \
  evidence-management-pk22
```

### Option 3: PM2 Deployment
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🔐 Default Login Credentials

After deployment, use these credentials to access the system:

**Admin Account**
- Email: `admin@pk22.ac.th`
- Password: `YourSecurePassword123!` (change this after first login)

## 🛠️ Post-Deployment Checklist

### Immediate Tasks
- [ ] Change default admin password
- [ ] Test login functionality
- [ ] Verify database connectivity
- [ ] Check file upload functionality
- [ ] Test all major features

### Configuration Tasks
- [ ] Set up academic years
- [ ] Configure education levels and standards
- [ ] Create user accounts for staff
- [ ] Set up indicator hierarchy
- [ ] Configure notification settings

### Security Tasks
- [ ] Enable SSL/HTTPS
- [ ] Configure firewall rules
- [ ] Set up backup procedures
- [ ] Configure monitoring
- [ ] Review security headers

## 📊 Health Check

Access the health check endpoint to verify deployment:
```
GET https://evidence.pk22.ac.th/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-23T...",
  "database": "connected",
  "version": "1.0.0"
}
```

## 🔍 Troubleshooting

### Database Connection Issues
1. Verify DATABASE_URL format
2. Check network connectivity to database server
3. Ensure database user has proper permissions
4. Test connection with psql client

### Application Startup Issues
1. Check environment variables
2. Verify Node.js version (18+)
3. Ensure all dependencies are installed
4. Check application logs

### Performance Issues
1. Monitor CPU and memory usage
2. Check database query performance
3. Review file upload performance
4. Enable performance monitoring

## 📞 Support Information

### System Information
- **Domain**: evidence.pk22.ac.th
- **Database**: PostgreSQL on port 5432
- **Application Port**: 3000
- **File Storage**: Local filesystem

### Important Files
- `.env.production` - Production environment variables
- `prisma/schema.prisma` - Database schema
- `Dockerfile` - Container configuration
- `ecosystem.config.js` - PM2 configuration

### Monitoring URLs
- Health Check: https://evidence.pk22.ac.th/api/health
- Admin Panel: https://evidence.pk22.ac.th/admin
- Login Page: https://evidence.pk22.ac.th/auth/signin

---

**🎉 Ready for Production Deployment!**

Make sure to follow the checklist above and test thoroughly before going live.