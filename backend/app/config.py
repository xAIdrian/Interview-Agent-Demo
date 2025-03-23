import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "GulpinSecretKeyXOAISUD(*^@#&)")
    DEBUG = True

    # MariaDB connection info
    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "W2Mhouse/*")
    #DB_PASSWORD = os.environ.get("DB_PASSWORD", "ilovemoney")
    DB_NAME = os.environ.get("DB_NAME", "gulpin")
    DB_PORT = int(os.environ.get("DB_PORT", 3306))

    # S3 Bucket for storing media or backups, if applicable
    S3_BUCKET_NAME = "gulpin-interviews"
    S3_REGION = "us-east-1"
    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY=***REMOVED***=***REMOVED*** = os.environ.get("AWS_SECRET_ACCESS_KEY=***REMOVED***=***REMOVED***")
    AWS_SESSION_TOKEN = os.environ.get("AWS_SESSION_TOKEN")

    # OpenAI API Key
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

    # LiveKit credentials
    LIVEKIT_URL = os.environ.get("LIVEKIT_URL")
    LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY")
    LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET")
    
    # Deepgram API Key
    DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY")

    # Required environment variables
    REQUIRED_ENV_VARS = [
        "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY=***REMOVED***=***REMOVED***", "AWS_SESSION_TOKEN",
        "OPENAI_API_KEY",
        "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET",
        "DEEPGRAM_API_KEY"
    ]
    
    # Check for missing environment variables
    missing_vars = [var for var in REQUIRED_ENV_VARS if os.environ.get(var) is None]
    if missing_vars:
        error_msg = f"Fatal Error: Missing required environment variables: {', '.join(missing_vars)}"
        raise EnvironmentError(error_msg)