# VPS Deployment Guide
## Evidence Management & Educational Quality Assessment System

### 🚀 Overview
คู่มือนี้จะแนะนำการ deploy ระบบ Evidence Management บน VPS (Virtual Private Server) ด้วย Docker และ Docker Compose

---

## Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04 LTS หรือ 22.04 LTS (แนะนำ)
- **CPU**: ขั้นต่ำ 2 cores, แนะนำ 4+ cores
- **RAM**: ขั้นต่ำ 4GB, แนะนำ 8GB+
- **Storage**: ขั้นต่ำ 50GB SSD, แนะนำ 100GB+
- **Network**: Static IP address
- **Bandwidth**: Unlimited หรือ ≥1TB/month

### Domain & SSL
- Domain name (เช่น evidence.school.ac.th)
- SSL Certificate (Let's Encrypt หรือ commercial)

---

## Step 1: Server Setup

### 1.1 Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip htop nano ufw fail2ban

# Create non-root user (if not exists)
sudo adduser deploy
sudo usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

### 1.2 Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Logout and login again to apply group changes
exit
su - deploy
```

### 1.3 Configure Firewall

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (change 22 to your SSH port if different)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow specific ports for monitoring (optional)
sudo ufw allow 9090/tcp  # Prometheus
sudo ufw allow 3001/tcp  # Grafana

# Check firewall status
sudo ufw status
```

### 1.4 Configure Fail2Ban

```bash
# Configure fail2ban for SSH protection
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit configuration
sudo nano /etc/fail2ban/jail.local

# Add/modify these settings:
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

# Restart fail2ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

---

## Step 2: SSL Certificate Setup

### 2.1 Install Certbot (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot

# Stop any web server that might be running
sudo systemctl stop apache2 nginx 2>/dev/null || true

# Generate SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Verify certificate
sudo ls -la /etc/letsencrypt/live/your-domain.com/
```

### 2.2 Setup Auto-renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for auto-renewal
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook "cd /home/deploy/evidence-management-system && docker-compose restart nginx"
```

---

## Step 3: Application Deployment

### 3.1 Clone Repository

```bash
# Clone the repository
cd /home/deploy
git clone https://github.com/your-username/evidence-management-system.git
cd evidence-management-system

# Create necessary directories
sudo mkdir -p /backups
sudo chown deploy:deploy /backups
mkdir -p uploads logs
```

### 3.2 Configure Environment

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit production configuration
nano .env.production
```

**Important environment variables:**
```bash
# Application
NODE_ENV=production
APP_URL=https://your-domain.com
PORT=3000

# Database
DATABASE_URL=postgresql://evidence_user:SECURE_PASSWORD@postgres:5432/evidence_management
POSTGRES_PASSWORD=SECURE_PASSWORD

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-super-secure-secret-key-32-chars-minimum

# Storage (MinIO)
STORAGE_ENDPOINT=http://minio:9000
STORAGE_ACCESS_KEY=your-minio-access-key
STORAGE_SECRET_KEY=your-minio-secret-key
STORAGE_BUCKET=evidence-files

# Email
RESEND_API_KEY=your-resend-api-key
FROM_EMAIL=noreply@your-domain.com

# Security
HTTPS_ENABLED=true
ENABLE_SECURITY_HEADERS=true
ENABLE_AUDIT_LOGGING=true

# Monitoring
ENABLE_PERFORMANCE_MONITORING=true
LOG_LEVEL=info
```

### 3.3 Setup SSL Certificates for Docker

```bash
# Create SSL directory for Docker
mkdir -p config/ssl

# Copy SSL certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem config/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem config/ssl/private.key

# Set proper permissions
sudo chown deploy:deploy config/ssl/*
chmod 600 config/ssl/private.key
chmod 644 config/ssl/cert.pem
```

### 3.4 Configure Nginx

```bash
# Update nginx configuration with your domain
sed -i 's/your-domain.com/your-actual-domain.com/g' config/nginx.conf

# Verify nginx configuration
cat config/nginx.conf | grep server_name
```

---

## Step 4: Deploy Application

### 4.1 Initial Deployment

```bash
# Make deployment script executable
chmod +x deploy.sh

# Run initial deployment
./deploy.sh deploy
```

### 4.2 Database Setup

```bash
# Wait for services to start
sleep 60

# Check service status
docker-compose ps

# Run database migrations
docker-compose exec app npm run db:migrate:deploy

# Seed initial data
docker-compose exec app npm run db:seed
```

### 4.3 Verify Deployment

```bash
# Check application health
curl -f https://your-domain.com/api/health

# Check logs
docker-compose logs app

# Test login
# Go to https://your-domain.com
# Default admin: admin@school.edu / admin123
```

---

## Step 5: Production Optimizations

### 5.1 Setup Automated Backups

```bash
# Install backup scheduler (requires root)
sudo ./scripts/automated-backup-scheduler.sh install

# Verify backup schedules
sudo crontab -l

# Test backup system
sudo ./scripts/backup.sh
```

### 5.2 Configure Monitoring

```bash
# Start monitoring services
docker-compose up -d prometheus loki

# Access monitoring dashboards
# Prometheus: https://your-domain.com:9090
# Logs: Check docker-compose logs loki
```

### 5.3 Performance Tuning

```bash
# Optimize Docker settings
sudo nano /etc/docker/daemon.json

# Add these settings:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}

# Restart Docker
sudo systemctl restart docker

# Restart application
docker-compose down
docker-compose up -d
```

---

## Step 6: Security Hardening

### 6.1 System Security

```bash
# Disable root SSH login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Change SSH port (optional but recommended)
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config

# Restart SSH
sudo systemctl restart ssh

# Update firewall for new SSH port
sudo ufw delete allow 22/tcp
sudo ufw allow 2222/tcp
```

### 6.2 Application Security

```bash
# Verify security headers
curl -I https://your-domain.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"

# Check for vulnerabilities
docker-compose exec app npm audit

# Update dependencies if needed
docker-compose exec app npm audit fix
```

### 6.3 Database Security

```bash
# Verify database encryption
docker-compose exec postgres psql -U evidence_user -d evidence_management -c "SHOW ssl;"

# Check database permissions
docker-compose exec postgres psql -U evidence_user -d evidence_management -c "\du"
```

---

## Step 7: Maintenance & Monitoring

### 7.1 Log Management

```bash
# Setup log rotation
sudo nano /etc/logrotate.d/evidence-system

# Add this configuration:
/home/deploy/evidence-management-system/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 deploy deploy
}

# Test log rotation
sudo logrotate -d /etc/logrotate.d/evidence-system
```

### 7.2 System Monitoring

```bash
# Create monitoring script
cat > ~/monitor.sh << 'EOF'
#!/bin/bash
echo "=== System Status $(date) ==="
echo "Disk Usage:"
df -h
echo -e "\nMemory Usage:"
free -h
echo -e "\nDocker Containers:"
docker-compose ps
echo -e "\nApplication Health:"
curl -s https://your-domain.com/api/health | jq .
EOF

chmod +x ~/monitor.sh

# Add to crontab for regular monitoring
crontab -e
# Add: */15 * * * * /home/deploy/monitor.sh >> /home/deploy/monitor.log 2>&1
```

### 7.3 Backup Verification

```bash
# Run backup verification
sudo ./scripts/backup-verification.sh

# Check backup space
df -h /backups

# Test restore procedure (monthly)
sudo ./scripts/disaster-recovery-test.sh
```

---

## Step 8: Domain & DNS Configuration

### 8.1 DNS Settings

```bash
# Configure these DNS records:
# A record: your-domain.com -> YOUR_VPS_IP
# CNAME: www.your-domain.com -> your-domain.com
```

### 8.2 Update Application URLs

```bash
# Update environment variables
nano .env.production

# Change these values:
APP_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com

# Restart application
docker-compose down
docker-compose up -d
```

---

## Step 9: Troubleshooting

### 9.1 Common Issues

**Service won't start:**
```bash
# Check logs
docker-compose logs service-name

# Check system resources
df -h
free -h

# Restart specific service
docker-compose restart service-name
```

**Database connection issues:**
```bash
# Check database status
docker-compose exec postgres pg_isready

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec app npm run db:test
```

**SSL certificate issues:**
```bash
# Check certificate validity
openssl x509 -in config/ssl/cert.pem -text -noout

# Renew certificate
sudo certbot renew --force-renewal

# Update Docker certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem config/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem config/ssl/private.key
docker-compose restart nginx
```

### 9.2 Performance Issues

```bash
# Check system resources
htop

# Check Docker stats
docker stats

# Optimize database
docker-compose exec postgres psql -U evidence_user -d evidence_management -c "ANALYZE;"

# Clear application cache
docker-compose exec app npm run cache:clear
```

---

## Step 10: Backup & Recovery

### 10.1 Manual Backup

```bash
# Create immediate backup
sudo ./scripts/backup.sh

# Verify backup
sudo ./scripts/backup-verification.sh
```

### 10.2 Disaster Recovery

```bash
# In case of complete failure:

# 1. Restore from backup
BACKUP_PATH="/backups/evidence-management-system_YYYYMMDD_HHMMSS"

# 2. Stop services
docker-compose down

# 3. Restore database
pg_restore -h localhost -p 5432 -U evidence_user -d evidence_management "$BACKUP_PATH/database/full_backup.dump"

# 4. Restore files
tar -xzf "$BACKUP_PATH/files/uploads.tar.gz" -C ./

# 5. Start services
docker-compose up -d
```

---

## Cost Estimation

### VPS Providers & Pricing

**DigitalOcean:**
- 4GB RAM, 2 CPU, 80GB SSD: $24/month
- 8GB RAM, 4 CPU, 160GB SSD: $48/month

**Linode:**
- 4GB RAM, 2 CPU, 80GB SSD: $24/month
- 8GB RAM, 4 CPU, 160GB SSD: $48/month

**Vultr:**
- 4GB RAM, 2 CPU, 80GB SSD: $24/month
- 8GB RAM, 4 CPU, 160GB SSD: $48/month

**Additional Costs:**
- Domain: $10-15/year
- SSL Certificate: Free (Let's Encrypt)
- Backup Storage: $5-10/month (optional)

---

## Maintenance Schedule

### Daily
- [ ] Check system health
- [ ] Review application logs
- [ ] Monitor disk usage
- [ ] Verify backup completion

### Weekly
- [ ] Update system packages
- [ ] Review security logs
- [ ] Test backup restoration
- [ ] Performance monitoring

### Monthly
- [ ] Security audit
- [ ] Full backup verification
- [ ] Disaster recovery test
- [ ] SSL certificate check

### Quarterly
- [ ] System optimization
- [ ] Security penetration test
- [ ] Documentation updates
- [ ] Capacity planning

---

## Support & Resources

### Useful Commands

```bash
# Application management
./deploy.sh status          # Check status
./deploy.sh logs app        # View logs
./deploy.sh backup          # Create backup
./deploy.sh rollback        # Rollback deployment

# Docker management
docker-compose ps           # List containers
docker-compose logs -f app  # Follow logs
docker-compose restart app # Restart service
docker system prune        # Clean up

# System monitoring
htop                       # System resources
df -h                      # Disk usage
free -h                    # Memory usage
sudo ufw status           # Firewall status
```

### Emergency Contacts
- **System Administrator**: admin@your-domain.com
- **Technical Support**: support@your-domain.com
- **VPS Provider Support**: [Provider's support contact]

---

**Last Updated**: $(date +'%Y-%m-%d')
**Version**: 1.0

*This guide provides complete instructions for deploying the Evidence Management System on a VPS with production-ready configuration, security, and monitoring.*