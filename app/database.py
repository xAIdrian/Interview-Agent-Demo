import mariadb
from config import Config

def get_db_connection():
    connection = mariadb.connect(
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        database=Config.DB_NAME
    )
    return connection