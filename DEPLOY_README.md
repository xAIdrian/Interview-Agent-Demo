Connect to the instance
```
ssh -i "key" user@ip address
```

Uploading to the instance
```
scp -i key -r backend user@ip:location
```

Before we navigate into our pip environment we need to configure MariaDB
```
sudo dnf install mariadb105
mysql --version
```

Test with gunicorn
```
gunicorn --bind 0.0.0.0:5001 --workers 4 --worker-class gevent interview_server:app
```

Test the endpoint is exposed
```
curl http://35.181.155.165:5001/health
```

Put the gunicorn on NGINX
```
# 1. Install Nginx if not already installed
sudo yum install nginx

# 2. Create Nginx configuration
sudo nano /etc/nginx/conf.d/interview_server.conf

# 3. Copy your existing Nginx configuration (it looks good from the files)
# Test the Nginx configuration
sudo nginx -t

# 4. Start and enable Nginx to run on boot
sudo systemctl start nginx
sudo systemctl enable nginx

# 5. Check Nginx status
sudo systemctl status nginx

# 6. Start and enable your Gunicorn service
sudo systemctl start interview_server
sudo systemctl enable interview_server

# 7. Check the Gunicorn service status
sudo systemctl status interview_server

# 8. Check the logs if needed
tail -f /home/ec2-user/livekit_server/logs/interview_server.out.log
tail -f /home/ec2-user/livekit_server/logs/interview_server.err.log
```

REAL command to check for errors in gunicorn
```
sudo journalctl -u interview_server.service -n 50 --no-pager
```

Running Docker in our EC2
``
# 1. Install Docker on EC2
sudo yum update -y
sudo yum install docker -y

# 2. Start Docker service
sudo service docker start
sudo systemctl enable docker

# 3. Add ec2-user to docker group (so you don't need sudo for docker commands)
sudo usermod -a -G docker ec2-user

# 4. Log out and back in for group changes to take effect, or run:
newgrp docker

# 5. Verify Docker is working
docker --version
docker ps

# 6. Pull your image from Docker Hub (replace with your image name)
docker pull your-docker-username/your-image-name

# 7. Run your container
docker run -d \
  -p 5001:5001 \
  --name your-container-name \
  your-docker-username/your-image-name
```
