#!/bin/bash

# Coolify Installation Script for Evidence Management System
# Run as root on Ubuntu 22.04 LTS

echo "🚀 Installing Coolify for Evidence Management System..."

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl wget git

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Add current user to docker group (if not root)
if [ "$USER" != "root" ]; then
    usermod -aG docker $USER
    echo "⚠️  Please log out and back in for docker group changes to take effect"
fi

# Install Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

echo "✅ Coolify installed successfully!"
echo ""
echo "📍 Access Coolify at: http://your-server-ip:8000"
echo "🔐 Follow the setup wizard to create your admin account"
echo ""
echo "Next Steps:"
echo "1. Access Coolify dashboard"
echo "2. Complete initial setup"
echo "3. Connect your GitHub repository"
echo "4. Deploy Evidence Management System"
echo "5. Add PostgreSQL database service"
echo "6. Configure domain and SSL"

# Create coolify deployment directory
mkdir -p /opt/evidence-management-system
cd /opt/evidence-management-system

echo ""
echo "🎯 Ready to deploy Evidence Management System with Coolify!"
echo "📖 See deploy/coolify-deploy.md for detailed instructions"