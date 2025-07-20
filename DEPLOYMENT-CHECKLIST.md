# Evidence Management System - Deployment Checklist

## Pre-Deployment Checklist

### ✅ Code and Repository
- [ ] All code committed and pushed to repository
- [ ] No sensitive data in repository (passwords, API keys, etc.)
- [ ] `.env.example` file updated with all required variables
- [ ] `CLAUDE.md` and documentation updated
- [ ] All tests passing (`npm test`)
- [ ] Code linting passed (`npm run lint`)
- [ ] Type checking passed (`npm run type-check`)

### ✅ Docker and Build
- [ ] Dockerfile tested locally
- [ ] Docker image builds successfully
- [ ] Health check endpoint working (`/api/health`)
- [ ] Next.js standalone build working
- [ ] All dependencies properly installed

### ✅ Database
- [ ] Database server accessible
- [ ] Database connection string available
- [ ] Prisma schema up to date
- [ ] Database migrations ready
- [ ] Seed data prepared

### ✅ Environment Variables
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `NEXTAUTH_SECRET` - Strong JWT secret (min 32 chars)
- [ ] `NEXTAUTH_URL` - Full application URL with https://
- [ ] Storage configuration (if using external storage)
- [ ] Email service configuration (if using notifications)
- [ ] Redis configuration (if using caching)

## Dokploy Deployment Steps

### Step 1: Create Application
- [ ] Login to Dokploy dashboard
- [ ] Create new application
- [ ] Set application name: `evidence-management-system`
- [ ] Connect Git repository
- [ ] Select correct branch (main/master)

### Step 2: Configure Build
- [ ] Build type: Dockerfile
- [ ] Dockerfile path: `Dockerfile`
- [ ] Build context: `/`
- [ ] Build arguments (if needed)

### Step 3: Environment Variables
Copy from `.env.example` and set:
- [ ] `DATABASE_URL`
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXTAUTH_URL`
- [ ] `NODE_ENV=production`
- [ ] `NEXT_TELEMETRY_DISABLED=1`
- [ ] Additional variables as needed

### Step 4: Configure Volumes
- [ ] Host path: `/var/dokploy/evidence/uploads`
- [ ] Container path: `/app/uploads`
- [ ] Type: bind mount

### Step 5: Network and Ports
- [ ] Container port: `3000`
- [ ] Health check path: `/api/health`
- [ ] Health check interval: `30s`

### Step 6: Domain Configuration
- [ ] Domain name configured
- [ ] SSL certificate enabled (Let's Encrypt)
- [ ] DNS records pointing to server
- [ ] HTTPS redirect enabled

### Step 7: Deploy Application
- [ ] Click Deploy button
- [ ] Monitor build logs
- [ ] Check deployment status
- [ ] Verify container is running

## Post-Deployment Steps

### Step 8: Database Initialization
Run in container terminal:
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database
npx prisma db seed
```
- [ ] Prisma client generated
- [ ] Database migrations applied
- [ ] Database seeded with initial data

### Step 9: Application Verification
- [ ] Application accessible via domain
- [ ] Health check responding (`/api/health`)
- [ ] Login page loading
- [ ] Can login with admin account
- [ ] Dashboard loading correctly
- [ ] File upload functionality working
- [ ] Database operations working

### Step 10: Security Configuration
- [ ] Change default admin password
- [ ] Create proper user accounts
- [ ] Delete/disable test accounts
- [ ] Review security headers
- [ ] Test authentication flows
- [ ] Verify authorization controls

### Step 11: Data Configuration
- [ ] Configure academic years
- [ ] Set up indicator hierarchy
- [ ] Configure education levels
- [ ] Set up evaluation criteria
- [ ] Test evidence upload
- [ ] Test evaluation workflows

## Production Optimization

### Performance
- [ ] Monitor application performance
- [ ] Check database query performance
- [ ] Monitor memory and CPU usage
- [ ] Test file upload performance
- [ ] Verify caching is working (if enabled)

### Monitoring
- [ ] Set up application monitoring
- [ ] Configure error tracking
- [ ] Set up uptime monitoring
- [ ] Configure backup monitoring
- [ ] Set up alert notifications

### Backup
- [ ] Database backup configured
- [ ] File backup configured
- [ ] Backup verification working
- [ ] Restore procedure tested
- [ ] Backup retention policy set

### Documentation
- [ ] Update deployment documentation
- [ ] Document environment-specific configurations
- [ ] Create user administration guide
- [ ] Document backup and recovery procedures
- [ ] Create troubleshooting guide

## Default Accounts (Change Immediately)

### Admin Account
- Email: `admin@example.com`
- Password: `admin123`
- Role: ADMIN

### Test Accounts (Delete in Production)
- Teacher: `teacher1@example.com` / `teacher123`
- IQA Evaluator: `iqa1@example.com` / `iqa123`
- EQA Evaluator: `eqa1@example.com` / `eqa123`
- Executive: `exec1@example.com` / `exec123`

## Troubleshooting Common Issues

### Application Won't Start
- [ ] Check environment variables
- [ ] Verify database connection
- [ ] Check container logs
- [ ] Verify port configuration

### Database Connection Issues
- [ ] Verify DATABASE_URL format
- [ ] Check database server accessibility
- [ ] Verify credentials
- [ ] Check network connectivity

### Authentication Issues
- [ ] Verify NEXTAUTH_SECRET is set
- [ ] Check NEXTAUTH_URL matches domain
- [ ] Verify JWT configuration
- [ ] Check session storage

### File Upload Issues
- [ ] Check volume mounting
- [ ] Verify directory permissions
- [ ] Check storage configuration
- [ ] Monitor disk space

### Performance Issues
- [ ] Monitor resource usage
- [ ] Check database performance
- [ ] Verify caching configuration
- [ ] Review application logs

## Support and Maintenance

### Regular Maintenance
- [ ] Monitor application logs
- [ ] Check system resources
- [ ] Review security alerts
- [ ] Update dependencies
- [ ] Test backup procedures

### Updates and Upgrades
- [ ] Test updates in staging
- [ ] Plan maintenance windows
- [ ] Backup before updates
- [ ] Monitor after deployment
- [ ] Document changes

---

## Completion Verification

Once all checkboxes are completed:
- [ ] Application is fully deployed and functional
- [ ] Security is properly configured
- [ ] Monitoring and backups are in place
- [ ] Documentation is updated
- [ ] Team is trained on new system

**Deployment Date:** _______________
**Deployed By:** _______________
**Verified By:** _______________