import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "GulpinSecretKeyXOAISUD(*^@#&)")
    DEBUG = True

    # MariaDB connection info
    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "W2Mhouse/*")
    DB_NAME = os.environ.get("DB_NAME", "gulpin")
    DB_PORT = int(os.environ.get("DB_PORT", 3306))

    # S3 Bucket for storing media or backups, if applicable
    S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "gulpin-interviews")
    S3_REGION = os.environ.get("S3_REGION", "us-east-1")