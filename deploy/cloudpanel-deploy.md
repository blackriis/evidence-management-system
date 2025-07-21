# CloudPanel Deployment Guide - Evidence Management System

## 1. Server Setup

### Install CloudPanel
```bash
# Run as root on Ubuntu 22.04 LTS
curl -sL https://installer.cloudpanel.io/ce/v2/install.sh | sudo bash

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Install PostgreSQL
apt install -y postgresql postgresql-contrib
```

### Initial CloudPanel Setup
1. Access `https://your-server-ip:8443`
2. Create admin account
3. Complete initial configuration

## 2. Domain & SSL Configuration

### Add Domain in CloudPanel
1. **Sites** → **Add Site**
2. **Site Type**: Node.js
3. **Domain**: your-domain.com (หรือใช้ IP)
4. **Node.js Version**: 20.x
5. **Document Root**: `/home/cloudpanel/htdocs/your-domain.com/`

### SSL Certificate
1. ไปที่ **SSL/TLS** tab
2. เลือก **Let's Encrypt**
3. กด **Create Certificate**

## 3. Database Setup

### Create PostgreSQL Database
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE evidence_management;
CREATE USER evidenceuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE evidence_management TO evidenceuser;
\q
```

### Database Connection String
```
DATABASE_URL="postgresql://evidenceuser:your_secure_password@localhost:5432/evidence_management"
```

## 4. Application Deployment

### Clone Repository
```bash
cd /home/cloudpanel/htdocs/your-domain.com/
git clone https://github.com/blackriis/evidence-management-system.git .
```

### Install Dependencies
```bash
npm install
npm run build
```

### Environment Variables
Create `.env.production.local`:
```bash
# Database
DATABASE_URL="postgresql://evidenceuser:password@localhost:5432/evidence_management"

# NextAuth
NEXTAUTH_SECRET="your-32-character-secret-key-here"
NEXTAUTH_URL="https://your-domain.com"

# File Storage
STORAGE_ENDPOINT="https://your-s3-endpoint.com"
STORAGE_ACCESS_KEY="your_access_key"
STORAGE_SECRET_KEY="your_secret_key"
STORAGE_BUCKET="evidence-files"
STORAGE_REGION="us-east-1"

# Email (Resend)
RESEND_API_KEY="your_resend_api_key"
FROM_EMAIL="noreply@your-domain.com"

# Line Notify (Optional)
LINE_NOTIFY_TOKEN="your_line_notify_token"

# Redis (Optional)
REDIS_URL="redis://localhost:6379"

# App URL
APP_URL="https://your-domain.com"
```

### Database Migration & Seeding
```bash
npx prisma migrate deploy
npx prisma db seed
```

### Start Application with PM2
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'evidence-management-system',
    script: 'server.js',
    cwd: '/home/cloudpanel/htdocs/your-domain.com',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log'
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 5. CloudPanel Application Configuration

### Node.js App Settings
1. **Applications** → **Add Application**
2. **Type**: Node.js
3. **Node.js Version**: 20.x
4. **Startup File**: server.js
5. **Port**: 3000
6. **Environment**: production

### Reverse Proxy Setup
CloudPanel จะตั้งค่า Nginx reverse proxy อัตโนมัติ:
- HTTP/HTTPS → Port 3000
- SSL termination
- Gzip compression
- Static file serving

## 6. Monitoring & Maintenance

### PM2 Process Management
```bash
# View status
pm2 status

# View logs
pm2 logs evidence-management-system

# Restart
pm2 restart evidence-management-system

# Stop
pm2 stop evidence-management-system
```

### Database Backup
```bash
# Create backup script
cat > /home/cloudpanel/backup-db.sh << EOF
#!/bin/bash
pg_dump -U evidenceuser -h localhost evidence_management > /home/cloudpanel/backups/evidence_\$(date +%Y%m%d_%H%M%S).sql
EOF

chmod +x /home/cloudpanel/backup-db.sh

# Add to crontab for daily backups
echo "0 2 * * * /home/cloudpanel/backup-db.sh" | crontab -
```

## 7. Security Considerations

### Firewall (UFW)
```bash
ufw enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8443/tcp  # CloudPanel
ufw allow 3000/tcp  # App (internal only)
```

### File Permissions
```bash
chown -R cloudpanel:cloudpanel /home/cloudpanel/htdocs/your-domain.com/
chmod 755 /home/cloudpanel/htdocs/your-domain.com/
```

## 8. Testing

### Health Checks
```bash
# Test application
curl https://your-domain.com/api/health

# Test database connection
curl https://your-domain.com/api/debug/db
```

### Login Test
- URL: `https://your-domain.com`
- Email: `admin@example.com`
- Password: `admin123`

## 9. Troubleshooting

### Common Issues
1. **Port conflicts**: ตรวจสอบ port 3000 ว่าถูกใช้งานหรือไม่
2. **Database connection**: ตรวจสอบ CONNECTION_STRING
3. **File permissions**: ตรวจสอบ ownership และ permissions
4. **SSL issues**: ใช้ CloudPanel SSL management

### Log Locations
- **Application**: `/home/cloudpanel/htdocs/your-domain.com/logs/`
- **Nginx**: `/var/log/nginx/`
- **PostgreSQL**: `/var/log/postgresql/`

## Advantages of CloudPanel

✅ **Easy SSL Management** - Let's Encrypt integration  
✅ **Domain Management** - Multiple domains support  
✅ **Database Management** - Built-in phpPgAdmin  
✅ **File Management** - Web-based file manager  
✅ **Monitoring** - Server resource monitoring  
✅ **Backup** - Automated backup solutions  
✅ **Security** - Built-in security features  