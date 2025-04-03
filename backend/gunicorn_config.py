import multiprocessing

# Worker configuration
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gevent"
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = "logs/gunicorn-access.log"
errorlog = "logs/gunicorn-error.log"
loglevel = "info"

# Bind
bind = "0.0.0.0:5001"

# Process naming
proc_name = "interview_server"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None
