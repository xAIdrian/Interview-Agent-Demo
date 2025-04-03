from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import QueuePool
from config import Config

# Create SQLAlchemy engine with connection pooling
engine = create_engine(
    f"mysql+pymysql://{Config.DB_USER}:{Config.DB_PASSWORD}@{Config.DB_HOST}:{Config.DB_PORT}/{Config.DB_NAME}",
    poolclass=QueuePool,
    pool_size=5,  # Number of permanent connections to keep
    max_overflow=10,  # Number of additional connections to create when pool is full
    pool_timeout=30,  # Seconds to wait before giving up on getting a connection from the pool
    pool_recycle=1800,  # Recycle connections after 30 minutes
    pool_pre_ping=True,  # Enable connection health checks
)

# Create session factory
SessionFactory = sessionmaker(bind=engine)

# Create thread-safe session
Session = scoped_session(SessionFactory)


def get_db_session():
    """Get a database session from the connection pool."""
    return Session()


def build_filter_query(table_name, filters):
    query = f"SELECT * FROM {table_name} WHERE "
    params = []
    conditions = []

    for key, value in filters.items():
        conditions.append(f"{key} = :{key}")
        params[key] = value

    query += " AND ".join(conditions)
    return query, params


def create_users_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT UNSIGNED PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (email)
            )
        """
            )
        )
        session.commit()
    finally:
        session.close()


def create_campaigns_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS campaigns (
                id BIGINT UNSIGNED PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                max_user_submissions INT NOT NULL DEFAULT 1,
                max_points INT NOT NULL,
                is_public BOOLEAN NOT NULL DEFAULT FALSE,
                campaign_context TEXT,
                job_description TEXT,
                created_by BIGINT UNSIGNED,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id),
                INDEX (is_public)
            )
        """
            )
        )
        session.commit()
    finally:
        session.close()


def create_questions_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS questions (
                id BIGINT UNSIGNED PRIMARY KEY,
                campaign_id BIGINT UNSIGNED NOT NULL,
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                scoring_prompt TEXT NOT NULL,
                max_points INT NOT NULL,
                order_index INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
                INDEX (campaign_id)
            )
        """
            )
        )
        session.commit()
    finally:
        session.close()


def create_submissions_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS submissions (
                id BIGINT UNSIGNED PRIMARY KEY,
                campaign_id BIGINT UNSIGNED NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                completed_at TIMESTAMP DEFAULT NULL,
                is_complete BOOLEAN NOT NULL DEFAULT FALSE,
                total_points INT DEFAULT NULL,
                resume_path VARCHAR(255) DEFAULT NULL,
                resume_text LONGTEXT DEFAULT NULL,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                INDEX (user_id, campaign_id),
                INDEX (is_complete)
            )
        """
            )
        )
        session.commit()
    finally:
        session.close()


def create_submission_answers_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS submission_answers (
                id BIGINT UNSIGNED PRIMARY KEY,
                submission_id BIGINT UNSIGNED NOT NULL,
                question_id BIGINT UNSIGNED NOT NULL,
                video_path VARCHAR(255) DEFAULT NULL,
                transcript TEXT NOT NULL,
                score INT DEFAULT NULL,
                score_rationale TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (submission_id) REFERENCES submissions(id),
                FOREIGN KEY (question_id) REFERENCES questions(id),
                INDEX (submission_id),
                INDEX (question_id),
                UNIQUE KEY (submission_id, question_id)
            )
        """
            )
        )
        session.commit()
    finally:
        session.close()


def create_tables():
    create_users_table()
    create_campaigns_table()
    create_questions_table()
    create_submissions_table()
    create_submission_answers_table()


def migrate_submissions_table_add_resume_columns():
    """Add resume_path and resume_text columns to the submissions table if they don't exist"""
    session = get_db_session()
    try:
        # Check if columns exist
        result = session.execute(
            text(
                """
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'submissions' 
            AND COLUMN_NAME = 'resume_path'
        """
            )
        )
        resume_path_exists = result.scalar() > 0

        result = session.execute(
            text(
                """
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'submissions' 
            AND COLUMN_NAME = 'resume_text'
        """
            )
        )
        resume_text_exists = result.scalar() > 0

        # Add columns if they don't exist
        if not resume_path_exists:
            session.execute(
                text(
                    """
                ALTER TABLE submissions
                ADD COLUMN resume_path VARCHAR(255) DEFAULT NULL
            """
                )
            )
            print("Added resume_path column to submissions table")

        if not resume_text_exists:
            session.execute(
                text(
                    """
                ALTER TABLE submissions
                ADD COLUMN resume_text LONGTEXT DEFAULT NULL
            """
                )
            )
            print("Added resume_text column to submissions table")

        session.commit()
        print("Migrations completed successfully")
    finally:
        session.close()


def ensure_string_id(id_value):
    """Convert any ID to a string to ensure consistent handling."""
    if id_value is None:
        return None
    return str(id_value)


def map_row_to_dict(row, columns, string_id_columns=None):
    """
    Map a database row to a dictionary, ensuring ID columns are strings.

    Args:
        row: Database row (tuple)
        columns: List of column names
        string_id_columns: List of column names that should be converted to strings
                          (default: ['id', 'user_id', 'campaign_id', 'submission_id', 'question_id'])

    Returns:
        Dictionary with column names as keys and values from the row
    """
    if string_id_columns is None:
        string_id_columns = [
            "id",
            "user_id",
            "campaign_id",
            "submission_id",
            "question_id",
        ]

    result = {}
    for i, column in enumerate(columns):
        if i < len(row):
            # Convert ID columns to strings
            if column in string_id_columns:
                result[column] = ensure_string_id(row[i])
            else:
                result[column] = row[i]

    return result
