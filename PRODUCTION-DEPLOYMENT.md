# Production Deployment Guide
## Evidence Management & Educational Quality Assessment System

### Overview
This guide provides comprehensive instructions for deploying the Evidence Management System in a production environment with proper security, monitoring, and backup procedures.

---

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 20.04 LTS or CentOS 8+
- **CPU**: Minimum 4 cores, Recommended 8 cores
- **RAM**: Minimum 8GB, Recommended 16GB
- **Storage**: Minimum 500GB SSD, Recommended 1TB+
- **Network**: Stable internet connection with static IP

### Software Dependencies
- Docker 20.10+
- Docker Compose 2.0+
- Git 2.25+
- SSL certificates (Let's Encrypt or commercial)
- SMTP server access for email notifications

---

## Pre-Deployment Setup

### 1. Server Preparation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git unzip htop

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Clone Repository
```bash
# Clone the repository
git clone https://github.com/your-org/evidence-management-system.git
cd evidence-management-system

# Checkout production branch
git checkout production
```

### 3. SSL Certificate Setup
```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/evidence-system

# For Let's Encrypt (recommended)
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem config/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem config/ssl/private.key

# Set proper permissions
sudo chmod 600 config/ssl/private.key
sudo chmod 644 config/ssl/cert.pem
```

---

## Configuration

### 1. Environment Configuration
```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit production configuration
nano .env.production
```

**Critical settings to configure:**
```bash
# Application
NODE_ENV=production
APP_URL=https://your-domain.com
NEXTAUTH_SECRET=your-super-secure-secret-key-32-chars-minimum

# Database
DATABASE_URL=postgresql://evidence_user:SECURE_PASSWORD@postgres:5432/evidence_management

# Storage
STORAGE_ENDPOINT=https://your-minio-endpoint.com
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key

# Email
RESEND_API_KEY=your-resend-api-key
FROM_EMAIL=noreply@your-domain.com

# Security
HTTPS_ENABLED=true
ENABLE_SECURITY_HEADERS=true
ENABLE_AUDIT_LOGGING=true
```

### 2. Database Configuration
```bash
# Generate secure database password
DB_PASSWORD=$(openssl rand -base64 32)
echo "Database password: $DB_PASSWORD"

# Update .env.production with the generated password
sed -i "s/CHANGE_THIS_PASSWORD/$DB_PASSWORD/g" .env.production
```

### 3. Backup Configuration
```bash
# Create backup directory
sudo mkdir -p /backups
sudo chown $USER:$USER /backups

# Configure backup retention (7 years = 2555 days)
echo "BACKUP_RETENTION_DAYS=2555" >> .env.production
```

---

## Deployment

### 1. Initial Deployment
```bash
# Make deployment script executable
chmod +x deploy.sh

# Run initial deployment
./deploy.sh deploy
```

### 2. Database Setup
```bash
# Wait for services to start
sleep 60

# Run database migrations
docker-compose exec app npm run db:migrate

# Seed initial data
docker-compose exec app npm run db:seed
```

### 3. Verify Deployment
```bash
# Check service status
./deploy.sh status

# Test health endpoint
curl -f https://your-domain.com/api/health

# Check logs
./deploy.sh logs app
```

---

## Post-Deployment Configuration

### 1. Setup Automated Backups
```bash
# Install backup scheduler (requires root)
sudo ./scripts/automated-backup-scheduler.sh install

# Verify backup schedules
sudo ./scripts/automated-backup-scheduler.sh show

# Test backup system
sudo ./scripts/automated-backup-scheduler.sh test
```

### 2. Configure Monitoring
```bash
# Start monitoring services
docker-compose up -d prometheus loki

# Access monitoring dashboards
# Prometheus: http://your-domain.com:9090
# Grafana: http://your-domain.com:3001 (if configured)
```

### 3. SSL Certificate Auto-Renewal
```bash
# Add certbot renewal to crontab
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook "docker-compose restart nginx"
```

### 4. Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 9090/tcp  # Prometheus (restrict to admin IPs)
```

---

## Security Hardening

### 1. System Security
```bash
# Disable root SSH login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Configure fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 2. Application Security
```bash
# Verify security headers
curl -I https://your-domain.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"

# Check for security vulnerabilities
docker-compose exec app npm audit

# Update dependencies if needed
docker-compose exec app npm audit fix
```

### 3. Database Security
```bash
# Verify database encryption
docker-compose exec postgres psql -U evidence_user -d evidence_management -c "SHOW ssl;"

# Check database permissions
docker-compose exec postgres psql -U evidence_user -d evidence_management -c "\du"
```

---

## Monitoring and Maintenance

### 1. Health Monitoring
```bash
# Setup health check monitoring
# Add to crontab:
*/5 * * * * curl -f https://your-domain.com/api/health || echo "Health check failed" | mail -s "EMS Health Alert" admin@your-domain.com
```

### 2. Log Monitoring
```bash
# Monitor application logs
docker-compose logs -f app

# Monitor system logs
sudo tail -f /var/log/syslog

# Monitor backup logs
sudo tail -f /var/log/evidence-backup-daily.log
```

### 3. Performance Monitoring
```bash
# Monitor system resources
htop

# Monitor Docker containers
docker stats

# Monitor database performance
docker-compose exec postgres psql -U evidence_user -d evidence_management -c "SELECT * FROM pg_stat_activity;"
```

---

## Backup and Recovery

### 1. Manual Backup
```bash
# Create immediate backup
sudo ./scripts/backup.sh

# Verify backup integrity
sudo ./scripts/backup-verification.sh
```

### 2. Restore from Backup
```bash
# List available backups
ls -la /backups/

# Restore from specific backup
sudo ./deploy.sh rollback

# Or restore manually:
# 1. Stop services
docker-compose down

# 2. Restore database
BACKUP_PATH="/backups/evidence-management-system_YYYYMMDD_HHMMSS"
pg_restore -h localhost -p 5432 -U evidence_user -d evidence_management "$BACKUP_PATH/database/full_backup.dump"

# 3. Restore files
tar -xzf "$BACKUP_PATH/files/uploads.tar.gz" -C ./

# 4. Start services
docker-compose up -d
```

### 3. Disaster Recovery Testing
```bash
# Run quarterly DR test
sudo ./scripts/disaster-recovery-test.sh

# Review DR documentation
cat docs/disaster-recovery.md
```

---

## Troubleshooting

### Common Issues

#### 1. Service Won't Start
```bash
# Check Docker logs
docker-compose logs service-name

# Check system resources
df -h
free -h

# Restart specific service
docker-compose restart service-name
```

#### 2. Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready

# Check database logs
docker-compose logs postgres

# Test database connection
docker-compose exec app npm run db:test
```

#### 3. File Upload Issues
```bash
# Check storage service
docker-compose exec minio mc admin info local

# Check upload directory permissions
ls -la uploads/

# Test storage connectivity
docker-compose exec app npm run storage:test
```

#### 4. SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in config/ssl/cert.pem -text -noout

# Test SSL configuration
curl -I https://your-domain.com

# Renew certificate
sudo certbot renew --force-renewal
```

### Performance Issues

#### 1. Slow Database Queries
```bash
# Check slow queries
docker-compose exec postgres psql -U evidence_user -d evidence_management -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Analyze and optimize
docker-compose exec postgres psql -U evidence_user -d evidence_management -c "ANALYZE;"
```

#### 2. High Memory Usage
```bash
# Check memory usage
docker stats

# Optimize Docker memory limits
# Edit docker-compose.yml and add memory limits
```

#### 3. Storage Issues
```bash
# Check disk usage
df -h

# Clean up old backups
find /backups -name "evidence-management-system_*" -mtime +30 -delete

# Clean up Docker images
docker system prune -a
```

---

## Maintenance Schedule

### Daily
- [ ] Check system health
- [ ] Review backup logs
- [ ] Monitor disk usage
- [ ] Check application logs

### Weekly
- [ ] Review security logs
- [ ] Update system packages
- [ ] Test backup restoration
- [ ] Performance monitoring review

### Monthly
- [ ] Security audit
- [ ] Dependency updates
- [ ] Full backup verification
- [ ] Disaster recovery test

### Quarterly
- [ ] Full disaster recovery simulation
- [ ] Security penetration testing
- [ ] Performance optimization review
- [ ] Documentation updates

---

## Support and Documentation

### Resources
- **Technical Documentation**: `/docs` directory
- **API Documentation**: `https://your-domain.com/api/docs`
- **Monitoring Dashboards**: `https://your-domain.com:9090`
- **Backup Reports**: `/var/log/evidence-backup-*.log`

### Emergency Contacts
- **System Administrator**: admin@your-domain.com
- **Technical Support**: support@your-domain.com
- **Emergency Hotline**: +1-XXX-XXX-XXXX

### Escalation Procedures
1. **Level 1**: Technical team response (0-30 minutes)
2. **Level 2**: Management notification (30-60 minutes)
3. **Level 3**: External vendor engagement (1-2 hours)
4. **Level 4**: Executive escalation (2-4 hours)

---

## Compliance and Audit

### Data Retention
- **Evidence Files**: 7 years minimum
- **Audit Logs**: 7 years minimum
- **Backup Data**: 7 years minimum
- **System Logs**: 90 days

### Security Compliance
- **Encryption**: All data encrypted at rest and in transit
- **Access Control**: Role-based permissions enforced
- **Audit Trail**: All actions logged and monitored
- **Backup Verification**: Monthly integrity checks

### Regular Audits
- **Security Audit**: Quarterly
- **Compliance Review**: Annually
- **Penetration Testing**: Annually
- **Disaster Recovery Test**: Quarterly

---

**Last Updated**: $(date +'%Y-%m-%d')
**Version**: 1.0
**Next Review**: $(date -d '+3 months' +'%Y-%m-%d')