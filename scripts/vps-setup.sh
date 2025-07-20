#!/bin/bash

# VPS Setup Script for Evidence Management System
# This script automates the initial VPS setup process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOY_USER="deploy"
SSH_PORT="2222"
DOMAIN=""
EMAIL=""

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root"
    fi
}

# Get user input
get_user_input() {
    echo "=== VPS Setup Configuration ==="
    
    read -p "Enter your domain name (e.g., evidence.school.ac.th): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        error "Domain name is required"
    fi
    
    read -p "Enter your email for SSL certificate: " EMAIL
    if [ -z "$EMAIL" ]; then
        error "Email is required"
    fi
    
    read -p "SSH port (default 2222): " SSH_PORT_INPUT
    if [ -n "$SSH_PORT_INPUT" ]; then
        SSH_PORT="$SSH_PORT_INPUT"
    fi
    
    echo ""
    echo "Configuration:"
    echo "Domain: $DOMAIN"
    echo "Email: $EMAIL"
    echo "SSH Port: $SSH_PORT"
    echo ""
    
    read -p "Continue with this configuration? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Setup cancelled"
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    apt update
    apt upgrade -y
    
    # Install essential packages
    apt install -y \
        curl \
        wget \
        git \
        unzip \
        htop \
        nano \
        vim \
        ufw \
        fail2ban \
        certbot \
        jq \
        tree \
        ncdu \
        iotop
    
    success "System packages updated"
}

# Create deploy user
create_deploy_user() {
    log "Creating deploy user..."
    
    if id "$DEPLOY_USER" &>/dev/null; then
        warning "User $DEPLOY_USER already exists"
    else
        adduser --disabled-password --gecos "" $DEPLOY_USER
        usermod -aG sudo $DEPLOY_USER
        success "Deploy user created"
    fi
    
    # Setup SSH directory
    mkdir -p /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    
    # Copy root's authorized_keys if exists
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
        chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh/authorized_keys
        chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
        success "SSH keys copied to deploy user"
    fi
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    # Remove old versions
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Add deploy user to docker group
    usermod -aG docker $DEPLOY_USER
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    success "Docker installed successfully"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (current port first, then new port)
    ufw allow 22/tcp
    ufw allow $SSH_PORT/tcp
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow monitoring ports (restrict to specific IPs in production)
    ufw allow 9090/tcp comment 'Prometheus'
    ufw allow 3001/tcp comment 'Grafana'
    
    # Enable firewall
    ufw --force enable
    
    success "Firewall configured"
}

# Configure SSH
configure_ssh() {
    log "Configuring SSH..."
    
    # Backup original config
    cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
    
    # Configure SSH settings
    cat > /etc/ssh/sshd_config << EOF
# SSH Configuration for Evidence Management System VPS
Port $SSH_PORT
Protocol 2

# Authentication
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# Security settings
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server

# Connection settings
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
MaxSessions 10

# Logging
SyslogFacility AUTH
LogLevel INFO
EOF
    
    # Test SSH configuration
    sshd -t
    
    # Restart SSH service
    systemctl restart ssh
    
    success "SSH configured (Port: $SSH_PORT)"
}

# Configure Fail2Ban
configure_fail2ban() {
    log "Configuring Fail2Ban..."
    
    # Copy default configuration
    cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
    
    # Create custom configuration
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = $SSH_PORT
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 3
EOF
    
    # Start and enable Fail2Ban
    systemctl start fail2ban
    systemctl enable fail2ban
    
    success "Fail2Ban configured"
}

# Setup SSL certificate
setup_ssl() {
    log "Setting up SSL certificate..."
    
    # Stop any running web servers
    systemctl stop apache2 nginx 2>/dev/null || true
    
    # Generate SSL certificate
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"
    
    if [ $? -eq 0 ]; then
        success "SSL certificate generated for $DOMAIN"
        
        # Setup auto-renewal
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'cd /home/$DEPLOY_USER/evidence-management-system && docker-compose restart nginx'") | crontab -
        
        success "SSL auto-renewal configured"
    else
        warning "SSL certificate generation failed. You can run it manually later."
    fi
}

# Create application directories
create_app_directories() {
    log "Creating application directories..."
    
    # Create directories
    mkdir -p /backups
    mkdir -p /var/log/evidence-system
    
    # Set permissions
    chown $DEPLOY_USER:$DEPLOY_USER /backups
    chown $DEPLOY_USER:$DEPLOY_USER /var/log/evidence-system
    
    success "Application directories created"
}

# Configure system limits
configure_system_limits() {
    log "Configuring system limits..."
    
    # Configure limits for better performance
    cat >> /etc/security/limits.conf << EOF

# Evidence Management System limits
$DEPLOY_USER soft nofile 65536
$DEPLOY_USER hard nofile 65536
$DEPLOY_USER soft nproc 4096
$DEPLOY_USER hard nproc 4096
EOF
    
    # Configure sysctl for better network performance
    cat >> /etc/sysctl.conf << EOF

# Evidence Management System network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 10
EOF
    
    # Apply sysctl changes
    sysctl -p
    
    success "System limits configured"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/evidence-system << EOF
/var/log/evidence-system/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $DEPLOY_USER $DEPLOY_USER
    postrotate
        /bin/kill -HUP \`cat /var/run/rsyslogd.pid 2> /dev/null\` 2> /dev/null || true
    endscript
}

/home/$DEPLOY_USER/evidence-management-system/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $DEPLOY_USER $DEPLOY_USER
}
EOF
    
    success "Log rotation configured"
}

# Create monitoring script
create_monitoring_script() {
    log "Creating monitoring script..."
    
    cat > /home/$DEPLOY_USER/monitor.sh << 'EOF'
#!/bin/bash

# System monitoring script
echo "=== System Status $(date) ==="

echo "Disk Usage:"
df -h | grep -E "(Filesystem|/dev/)"

echo -e "\nMemory Usage:"
free -h

echo -e "\nLoad Average:"
uptime

echo -e "\nTop Processes:"
ps aux --sort=-%cpu | head -6

echo -e "\nDocker Status:"
if command -v docker &> /dev/null; then
    docker system df
    echo -e "\nRunning Containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

echo -e "\nDisk I/O:"
iostat -x 1 1 | tail -n +4

echo -e "\nNetwork Connections:"
ss -tuln | grep LISTEN | wc -l
echo "Active connections: $(ss -tuln | grep LISTEN | wc -l)"

echo "================================"
EOF
    
    chmod +x /home/$DEPLOY_USER/monitor.sh
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/monitor.sh
    
    success "Monitoring script created"
}

# Final setup
final_setup() {
    log "Performing final setup..."
    
    # Create welcome message
    cat > /etc/motd << EOF

╔══════════════════════════════════════════════════════════════╗
║                Evidence Management System VPS                ║
║                                                              ║
║  Domain: $DOMAIN                                    ║
║  SSH Port: $SSH_PORT                                              ║
║  Deploy User: $DEPLOY_USER                                        ║
║                                                              ║
║  Next Steps:                                                 ║
║  1. Login as $DEPLOY_USER user                                    ║
║  2. Clone the application repository                         ║
║  3. Configure environment variables                          ║
║  4. Run deployment script                                    ║
║                                                              ║
║  Documentation: /home/$DEPLOY_USER/VPS-DEPLOYMENT.md             ║
╚══════════════════════════════════════════════════════════════╝

EOF
    
    # Set timezone (optional)
    timedatectl set-timezone Asia/Bangkok
    
    # Update package database one more time
    apt update
    
    success "Final setup completed"
}

# Display summary
display_summary() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    VPS Setup Complete!                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Configuration Summary:"
    echo "• Domain: $DOMAIN"
    echo "• SSH Port: $SSH_PORT"
    echo "• Deploy User: $DEPLOY_USER"
    echo "• SSL Certificate: $([ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ] && echo 'Generated' || echo 'Manual setup required')"
    echo "• Firewall: Enabled"
    echo "• Fail2Ban: Enabled"
    echo "• Docker: Installed"
    echo ""
    echo "Next Steps:"
    echo "1. Login as $DEPLOY_USER:"
    echo "   ssh $DEPLOY_USER@$DOMAIN -p $SSH_PORT"
    echo ""
    echo "2. Clone the repository:"
    echo "   git clone https://github.com/your-username/evidence-management-system.git"
    echo ""
    echo "3. Follow the VPS-DEPLOYMENT.md guide for application setup"
    echo ""
    echo "Important Notes:"
    echo "• SSH root login is now DISABLED"
    echo "• SSH port changed to $SSH_PORT"
    echo "• Update your SSH client configuration"
    echo "• Firewall is active - only specified ports are open"
    echo ""
    warning "Make sure you can login as $DEPLOY_USER before closing this session!"
}

# Main execution
main() {
    log "Starting VPS setup for Evidence Management System"
    
    check_root
    get_user_input
    
    update_system
    create_deploy_user
    install_docker
    configure_firewall
    configure_ssh
    configure_fail2ban
    setup_ssl
    create_app_directories
    configure_system_limits
    setup_log_rotation
    create_monitoring_script
    final_setup
    
    display_summary
    
    success "VPS setup completed successfully!"
}

# Run main function
main "$@"