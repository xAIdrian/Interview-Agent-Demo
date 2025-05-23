# Deployment Guide

## Backend Deployment

### 1. Prepare Backend for Deployment
```bash
# Clean and copy backend directory
rm -r deploy_backend && cp -r backend deploy_backend && rm -r deploy_backend/venv

# Verify the copy
ls -la | grep deploy_backend
```

### 2. Transfer Backend to Server
```bash
# Copy files to server
scp -i "NoorIA.pem" -r deploy_backend/* ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com:~/noor_ai

# SSH into server
ssh -i "NoorIA.pem" ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com
```

### 3. Server Setup
```bash
# Navigate to project directory
cd noor_ai

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install supervisor

# Verify supervisor installation
which supervisord
```

### 4. Environment Configuration
```bash
# Create and edit .env file
touch .env
nano .env
# Add your environment variables and API keys
```

## Frontend Deployment

### 1. Prepare Frontend for Deployment
```bash
# Clean and copy frontend directory
rm -r deploy_frontend && cp -r frontend deploy_frontend && rm -r deploy_frontend/node_modules && rm -r deploy_frontend/.next
```

### 2. Transfer Frontend to Server
```bash
# Copy files to server
scp -i "NoorIA.pem" -r deploy_frontend/* ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com:~/noor_ui

# SSH into server
ssh -i "NoorIA.pem" ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com
```

### 3. Server Setup
```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git

# Navigate to frontend directory
cd /home/ec2-user/noor_ui

# Install dependencies and build
npm install --legacy-peer-deps
npm run build -- --no-lint
```

## Supervisor Configuration

### 1. Create Supervisor Configuration
Create a `supervisord.conf` file with the following content:

```ini
[unix_http_server]
file=/tmp/supervisor.sock
chmod=0700

[supervisord]
logfile=supervisord.log
pidfile=supervisord.pid

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[supervisorctl]
serverurl=unix:///tmp/supervisor.sock

[program:flask_service]
directory=/home/ec2-user/noor_ai
command=/home/ec2-user/noor_ai/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 app:app
autostart=true
autorestart=true
stderr_logfile=flask.err.log
stdout_logfile=flask.out.log

[program:worker_service]
directory=/home/ec2-user/noor_ai/livekit
command=/home/ec2-user/noor_ai/venv/bin/python interview_agent.py dev
autostart=true
autorestart=true
stderr_logfile=worker.err.log
stdout_logfile=worker.out.log

[program:nextjs_app]
directory=/home/ec2-user/noor_ui
command=/usr/bin/npm run start -- -p 5001 -H 0.0.0.0
autostart=true
autorestart=true
stderr_logfile=next.err.log
stdout_logfile=next.out.log
environment=NODE_ENV="production",PATH="/usr/bin:%(ENV_PATH)s"
```

### 2. Start Services
```bash
# Stop existing supervisor processes
pkill supervisord

# Start supervisor with new configuration
supervisord -c supervisord.conf

# Check status
supervisorctl -c supervisord.conf status
```

## HTTPS Configuration

### 1. Install Certbot
```bash
sudo yum install -y certbot python3-certbot-nginx
```

### 2. Configure SSL Certificates
```bash
sudo certbot --nginx -d api.kwiks.io -d noor.kwiks.io
```

## Quick Commands

### Start Services
```bash
supervisord -c supervisord.conf && supervisorctl -c supervisord.conf status
```

### Stop Services
```bash
supervisorctl -c supervisord.conf stop all && pkill supervisord
```

### Deploy Code Changes Only
```bash
# Deploy backend changes
rsync -avz --progress -e "ssh -i NoorIA.pem" ./deploy_backend/ ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com:/home/ec2-user/noor_ai/

# Deploy frontend changes
rsync -avz --progress -e "ssh -i NoorIA.pem" ./deploy_frontend/ ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com:/home/ec2-user/noor_ui/
```

## Version Management

### 1. Automatic Version Increment
Before deployment, the build number is automatically incremented using the version manager:
```bash
# Increment build number
node scripts/version-manager.js increment-build
```

### 2. Manual Version Updates (if needed)
For major, minor, or patch updates:
```bash
# Increment major version (e.g., v1.0.0 -> v2.0.0)
node scripts/version-manager.js increment-major

# Increment minor version (e.g., v1.0.0 -> v1.1.0)
node scripts/version-manager.js increment-minor

# Increment patch version (e.g., v1.0.0 -> v1.0.1)
node scripts/version-manager.js increment-patch
``` 
