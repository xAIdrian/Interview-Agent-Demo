See DEPLOY_README.md for configuration of Gunicorn

### Copy directory and send to server

rm -r deploy_backend && cp -r backend deploy_backend && rm -r deploy_backend/venv

ls -la | grep deploy_backend

---

scp -i "NoorIA.pem" -r deploy_backend/* ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com:~/noor_ai  

ssh -i "NoorIA.pem" ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com

### Configure Supervisor for multi-threading

nano supervisord.conf

```
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
```

cd noor_ai

python3 -m venv venv

source venv/bin/activate

pip install -r requirements.txt

pip install supervisor

which supervisord

---

touch .env

nano .env

```
Add your keys...
```

### Deploy frontend app

rm -r deploy_frontend && cp -r frontend deploy_frontend && rm -r deploy_frontend/node_modules && rm -r deploy_frontend/.next

scp -i "NoorIA.pem" -r deploy_frontend/* ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com:~/noor_ui    

ssh -i "NoorIA.pem" ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com

curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -

sudo yum install -y nodejs git

cd /home/ec2-user/noor_ui

npm install --legacy-peer-deps

npm run build -- --no-lint

npm run start -- -p 5002 -H 0.0.0.0

Add this block at the bottom of your supervisord.conf:

```
[program:nextjs_app]
directory=/home/ec2-user/noor_ui
command=/usr/bin/npm run start -- -p 5001 -H 0.0.0.0
autostart=true
autorestart=true
stderr_logfile=next.err.log
stdout_logfile=next.out.log
environment=NODE_ENV="production",PATH="/usr/bin:%(ENV_PATH)s"
```


### Multi-threading

cd ..

pkill supervisord

supervisord -c supervisord.conf

supervisorctl -c supervisord.conf status

Our goal:
```
(venv) [ec2-user@ip-172-31-37-69 ~]$ supervisorctl -c supervisord.conf status

flask_service                    RUNNING   pid 43703, uptime 0:00:05
nextjs_app                       RUNNING   pid 43722, uptime 0:00:02
worker_service                   RUNNING   pid 43705, uptime 0:00:05
```

### Just useful commans

If we want to start and check status
```
supervisord -c supervisord.conf && supervisorctl -c supervisord.conf status
```

If we want to stop
```
supervisorctl -c supervisord.conf stop all && pkill supervisord
```

**Getting to HTTPS**

sudo yum install -y certbot python3-certbot-nginx

sudo certbot --nginx -d api.kwiks.io -d noor.kwiks.io

### Deploy only code changes

rsync -avz --progress -e "ssh -i NoorIA.pem" ./deploy_backend/ ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com:/home/ec2-user/noor_ai/

rsync -avz --progress -e "ssh -i NoorIA.pem" ./deploy_frontend/ ec2-user@ec2-13-39-1-131.eu-west-3.compute.amazonaws.com:/home/ec2-user/noor_ui/
