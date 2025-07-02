#!/bin/bash

# Radio Admin Panel - Automated Installation Script for Ubuntu Server 22.04
# Author: Radio Admin Panel Team
# Version: 1.0.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logo
echo -e "${BLUE}"
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    ██████╗  █████╗ ██████╗ ██╗ ██████╗      █████╗ ██████╗  ║
║    ██╔══██╗██╔══██╗██╔══██╗██║██╔═══██╗    ██╔══██╗██╔══██╗ ║
║    ██████╔╝███████║██║  ██║██║██║   ██║    ███████║██║  ██║ ║
║    ██╔══██╗██╔══██║██║  ██║██║██║   ██║    ██╔══██║██║  ██║ ║
║    ██║  ██║██║  ██║██████╔╝██║╚██████╔╝    ██║  ██║██████╔╝ ║
║    ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝ ╚═════╝     ╚═╝  ╚═╝╚═════╝  ║
║                                                              ║
║           PROFESSIONAL RADIO ADMINISTRATION PANEL            ║
║                    Automated Installer v1.0                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}This script should not be run as root for security reasons${NC}"
   echo -e "${YELLOW}Please run as a regular user with sudo privileges${NC}"
   exit 1
fi

# Check Ubuntu version
if ! lsb_release -a 2>/dev/null | grep -q "Ubuntu 22.04"; then
    echo -e "${YELLOW}Warning: This script is optimized for Ubuntu 22.04 LTS${NC}"
    echo -e "${YELLOW}Continue anyway? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo -e "${RED}Installation cancelled${NC}"
        exit 1
    fi
fi

# Configuration
INSTALL_DIR="/opt/radio-admin"
SERVICE_USER="radio-admin"
NGINX_DOMAIN="your-domain.com"
DB_NAME="radio_admin"
DB_USER="radio_admin"

echo -e "${CYAN}🔧 Starting Radio Admin Panel Installation...${NC}\n"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Update system
echo -e "${BLUE}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y
print_status "System updated"

# Install required packages
echo -e "${BLUE}📦 Installing required packages...${NC}"
sudo apt install -y \
    curl \
    wget \
    git \
    nginx \
    supervisor \
    mongodb \
    nodejs \
    npm \
    python3 \
    python3-pip \
    python3-venv \
    ufw \
    certbot \
    python3-certbot-nginx \
    icecast2 \
    liquidsoap \
    fail2ban \
    htop \
    tree \
    unzip
print_status "Required packages installed"

# Install Node.js 18 LTS
echo -e "${BLUE}📦 Installing Node.js 18 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
print_status "Node.js installed: $(node --version)"

# Install Yarn
echo -e "${BLUE}📦 Installing Yarn...${NC}"
npm install -g yarn
print_status "Yarn installed: $(yarn --version)"

# Create service user
echo -e "${BLUE}👤 Creating service user...${NC}"
if ! id "$SERVICE_USER" &>/dev/null; then
    sudo useradd -r -s /bin/bash -d $INSTALL_DIR $SERVICE_USER
    print_status "Service user created: $SERVICE_USER"
else
    print_warning "Service user already exists: $SERVICE_USER"
fi

# Create installation directory
echo -e "${BLUE}📁 Creating installation directory...${NC}"
sudo mkdir -p $INSTALL_DIR
sudo chown $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
print_status "Installation directory created: $INSTALL_DIR"

# Clone repository or copy files
echo -e "${BLUE}📥 Setting up application files...${NC}"
sudo -u $SERVICE_USER mkdir -p $INSTALL_DIR/{backend,frontend,logs,backups}

# Copy application files (assuming we're in the app directory)
if [ -d "./backend" ] && [ -d "./frontend" ]; then
    sudo -u $SERVICE_USER cp -r ./backend/* $INSTALL_DIR/backend/
    sudo -u $SERVICE_USER cp -r ./frontend/* $INSTALL_DIR/frontend/
    print_status "Application files copied"
else
    print_error "Application files not found in current directory"
    exit 1
fi

# Setup Python virtual environment
echo -e "${BLUE}🐍 Setting up Python virtual environment...${NC}"
sudo -u $SERVICE_USER python3 -m venv $INSTALL_DIR/backend/venv
sudo -u $SERVICE_USER $INSTALL_DIR/backend/venv/bin/pip install --upgrade pip
sudo -u $SERVICE_USER $INSTALL_DIR/backend/venv/bin/pip install -r $INSTALL_DIR/backend/requirements.txt
print_status "Python virtual environment configured"

# Install frontend dependencies
echo -e "${BLUE}⚛️  Installing frontend dependencies...${NC}"
cd $INSTALL_DIR/frontend
sudo -u $SERVICE_USER yarn install
sudo -u $SERVICE_USER yarn build
print_status "Frontend built successfully"

# Configure MongoDB
echo -e "${BLUE}🗄️  Configuring MongoDB...${NC}"
sudo systemctl enable mongod
sudo systemctl start mongod

# Wait for MongoDB to start
sleep 5

# Create database and user
mongo --eval "
use $DB_NAME;
db.createUser({
  user: '$DB_USER',
  pwd: '$(openssl rand -base64 32)',
  roles: [{ role: 'readWrite', db: '$DB_NAME' }]
});
"
print_status "MongoDB configured"

# Configure environment variables
echo -e "${BLUE}⚙️  Configuring environment variables...${NC}"

# Backend .env
sudo -u $SERVICE_USER cat > $INSTALL_DIR/backend/.env << EOF
MONGO_URL=mongodb://localhost:27017/$DB_NAME
JWT_SECRET=$(openssl rand -base64 64)
ENVIRONMENT=production
DEBUG=false
ICECAST_HOST=localhost
ICECAST_PORT=8000
ICECAST_ADMIN_PASSWORD=$(openssl rand -base64 16)
ICECAST_SOURCE_PASSWORD=$(openssl rand -base64 16)
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=noreply@$NGINX_DOMAIN
SMTP_PASSWORD=$(openssl rand -base64 16)
EOF

# Frontend .env
sudo -u $SERVICE_USER cat > $INSTALL_DIR/frontend/.env << EOF
REACT_APP_BACKEND_URL=https://$NGINX_DOMAIN/api
REACT_APP_ENVIRONMENT=production
EOF

print_status "Environment variables configured"

# Configure Icecast2
echo -e "${BLUE}📻 Configuring Icecast2...${NC}"
ICECAST_PASSWORD=$(openssl rand -base64 16)

sudo cat > /etc/icecast2/icecast.xml << EOF
<icecast>
    <location>Earth</location>
    <admin>admin@$NGINX_DOMAIN</admin>

    <limits>
        <clients>100</clients>
        <sources>10</sources>
        <queue-size>524288</queue-size>
        <client-timeout>30</client-timeout>
        <header-timeout>15</header-timeout>
        <source-timeout>10</source-timeout>
        <burst-on-connect>1</burst-on-connect>
        <burst-size>65535</burst-size>
    </limits>

    <authentication>
        <source-password>$ICECAST_PASSWORD</source-password>
        <relay-password>$ICECAST_PASSWORD</relay-password>
        <admin-user>admin</admin-user>
        <admin-password>$ICECAST_PASSWORD</admin-password>
    </authentication>

    <hostname>$NGINX_DOMAIN</hostname>

    <listen-socket>
        <port>8000</port>
    </listen-socket>

    <fileserve>1</fileserve>

    <paths>
        <basedir>/usr/share/icecast2</basedir>
        <logdir>/var/log/icecast2</logdir>
        <webroot>/usr/share/icecast2/web</webroot>
        <adminroot>/usr/share/icecast2/admin</adminroot>
        <alias source="/" destination="/status.xsl"/>
    </paths>

    <logging>
        <accesslog>access.log</accesslog>
        <errorlog>error.log</errorlog>
        <loglevel>3</loglevel>
        <logsize>10000</logsize>
    </logging>

    <security>
        <chroot>0</chroot>
        <changeowner>
            <user>icecast2</user>
            <group>icecast</group>
        </changeowner>
    </security>
</icecast>
EOF

sudo systemctl enable icecast2
sudo systemctl start icecast2
print_status "Icecast2 configured and started"

# Configure Supervisor
echo -e "${BLUE}👷 Configuring Supervisor...${NC}"

# Backend service
sudo cat > /etc/supervisor/conf.d/radio-admin-backend.conf << EOF
[program:radio-admin-backend]
command=$INSTALL_DIR/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
directory=$INSTALL_DIR/backend
user=$SERVICE_USER
autostart=true
autorestart=true
stderr_logfile=$INSTALL_DIR/logs/backend.err.log
stdout_logfile=$INSTALL_DIR/logs/backend.out.log
environment=PATH="$INSTALL_DIR/backend/venv/bin"
EOF

# Frontend service (using serve for production)
sudo -u $SERVICE_USER npm install -g serve

sudo cat > /etc/supervisor/conf.d/radio-admin-frontend.conf << EOF
[program:radio-admin-frontend]
command=serve -s build -l 3000
directory=$INSTALL_DIR/frontend
user=$SERVICE_USER
autostart=true
autorestart=true
stderr_logfile=$INSTALL_DIR/logs/frontend.err.log
stdout_logfile=$INSTALL_DIR/logs/frontend.out.log
EOF

sudo supervisorctl reread
sudo supervisorctl update
print_status "Supervisor configured"

# Configure Nginx
echo -e "${BLUE}🌐 Configuring Nginx...${NC}"
sudo cat > /etc/nginx/sites-available/radio-admin << EOF
server {
    listen 80;
    server_name $NGINX_DOMAIN;

    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $NGINX_DOMAIN;

    # SSL Configuration (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/$NGINX_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$NGINX_DOMAIN/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Icecast streams
    location /streams {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static files
    location /static {
        alias $INSTALL_DIR/frontend/build/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/radio-admin /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
print_status "Nginx configured"

# Configure UFW Firewall
echo -e "${BLUE}🔒 Configuring firewall...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 8000/tcp  # Icecast
sudo ufw --force enable
print_status "Firewall configured"

# Configure Fail2Ban
echo -e "${BLUE}🛡️  Configuring Fail2Ban...${NC}"
sudo cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
print_status "Fail2Ban configured"

# Setup SSL Certificate
echo -e "${BLUE}🔐 Setting up SSL certificate...${NC}"
print_warning "Please ensure DNS is pointing to this server before continuing"
echo -e "${YELLOW}Domain: $NGINX_DOMAIN${NC}"
echo -e "${YELLOW}Continue with SSL setup? (y/N)${NC}"
read -r ssl_response
if [[ "$ssl_response" =~ ^[Yy]$ ]]; then
    sudo certbot --nginx -d $NGINX_DOMAIN --non-interactive --agree-tos --email admin@$NGINX_DOMAIN
    print_status "SSL certificate configured"
else
    print_warning "SSL setup skipped - remember to run: sudo certbot --nginx -d $NGINX_DOMAIN"
fi

# Setup backup script
echo -e "${BLUE}💾 Setting up backup system...${NC}"
sudo -u $SERVICE_USER cat > $INSTALL_DIR/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/radio-admin/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
DB_NAME="radio_admin"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mongodump --db $DB_NAME --out $BACKUP_DIR/db_$DATE

# Backup configuration files
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    /opt/radio-admin/backend/.env \
    /opt/radio-admin/frontend/.env \
    /etc/nginx/sites-available/radio-admin \
    /etc/icecast2/icecast.xml

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

sudo chmod +x $INSTALL_DIR/backup.sh

# Setup cron job for daily backups
echo "0 2 * * * $INSTALL_DIR/backup.sh" | sudo -u $SERVICE_USER crontab -
print_status "Backup system configured"

# Start all services
echo -e "${BLUE}🚀 Starting all services...${NC}"
sudo supervisorctl start all
sudo systemctl restart nginx
print_status "All services started"

# Final status check
echo -e "${BLUE}🔍 Checking service status...${NC}"
if sudo supervisorctl status | grep -q "RUNNING"; then
    print_status "Radio Admin Panel services are running"
else
    print_error "Some services failed to start"
fi

if sudo systemctl is-active --quiet nginx; then
    print_status "Nginx is running"
else
    print_error "Nginx failed to start"
fi

if sudo systemctl is-active --quiet mongod; then
    print_status "MongoDB is running"
else
    print_error "MongoDB failed to start"
fi

if sudo systemctl is-active --quiet icecast2; then
    print_status "Icecast2 is running"
else
    print_error "Icecast2 failed to start"
fi

# Display final information
echo -e "\n${GREEN}🎉 INSTALLATION COMPLETED SUCCESSFULLY! 🎉${NC}\n"

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    INSTALLATION SUMMARY                     ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC} Web Panel: ${GREEN}https://$NGINX_DOMAIN${NC}                           ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Admin User: ${YELLOW}admin${NC}                                          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Admin Pass: ${YELLOW}admin123${NC}                                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Icecast Admin: ${YELLOW}https://$NGINX_DOMAIN:8000/admin${NC}           ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Icecast User: ${YELLOW}admin${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Icecast Pass: ${YELLOW}$ICECAST_PASSWORD${NC}                           ${CYAN}║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC} Installation Directory: ${BLUE}$INSTALL_DIR${NC}                    ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Service User: ${BLUE}$SERVICE_USER${NC}                               ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Database: ${BLUE}$DB_NAME${NC}                                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Logs: ${BLUE}$INSTALL_DIR/logs${NC}                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC} Backups: ${BLUE}$INSTALL_DIR/backups${NC}                        ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}📋 IMPORTANT NOTES:${NC}"
echo -e "${YELLOW}• Change default admin password after first login${NC}"
echo -e "${YELLOW}• Configure your domain DNS to point to this server${NC}"
echo -e "${YELLOW}• Backups run daily at 2 AM${NC}"
echo -e "${YELLOW}• Check logs: sudo supervisorctl tail -f radio-admin-backend${NC}"
echo -e "${YELLOW}• Restart services: sudo supervisorctl restart all${NC}"

echo -e "\n${GREEN}🚀 Your Radio Admin Panel is ready!${NC}"
echo -e "${GREEN}Visit: https://$NGINX_DOMAIN${NC}\n"