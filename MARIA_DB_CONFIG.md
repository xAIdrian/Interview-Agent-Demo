Looking at the error message, I can see the specific paths where MariaDB is trying to operate:
First, let's find where MariaDB is actually installed:
Apply to MARIA_DB_CON...
Run
ls -l /usr/local/Cellar/mariadb/11.7.2/bin/
Let's check the actual process and socket locations:
Apply to MARIA_DB_CON...
Run
ls -la /usr/local/var/mysql/
Let's update the configuration to match these actual paths. Create/edit the config file:
Apply to MARIA_DB_CON...
Run
sudo nano /usr/local/etc/my.cnf
Add these lines:
Apply to MARIA_DB_CON...
sock
Let's ensure the directories exist with proper permissions:
Apply to MARIA_DB_CON...
Run
sudo chown -R $(whoami) /usr/local/var/mysql
Clean up any stale files:
Apply to MARIA_DB_CON...
Run
sudo rm -f /usr/local/var/mysql/*.sock
Try starting MariaDB using the actual binary path:
Apply to MARIA_DB_CON...
Run
/usr/local/Cellar/mariadb/11.7.2/bin/mariadbd-safe --datadir=/usr/local/var/mysql
Let's start 
