#!/bin/bash

# CloudPanel Installation Script for Evidence Management System
# Run as root on Ubuntu 22.04 LTS

echo "🚀 Installing CloudPanel for Evidence Management System..."

# Update system
apt update && apt upgrade -y

# Install CloudPanel
curl -sL https://installer.cloudpanel.io/ce/v2/install.sh | sudo bash

echo "✅ CloudPanel installed!"
echo "📍 Access: https://your-server-ip:8443"
echo "👤 Default login will be created during first setup"

# Install additional dependencies for Node.js apps
apt install -y curl software-properties-common

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Configure PostgreSQL
sudo -u postgres createuser --interactive --pwprompt evidenceuser
sudo -u postgres createdb evidence_management

echo "✅ All dependencies installed!"
echo ""
echo "Next Steps:"
echo "1. Access CloudPanel at https://your-server-ip:8443"
echo "2. Complete initial setup"
echo "3. Add your domain"
echo "4. Create Node.js application"
echo "5. Deploy the Evidence Management System"