from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import QueuePool
from config import Config
import sqlite3
import os

# Create SQLAlchemy engine with connection pooling for SQLite

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "interview_agent.db")
engine = create_engine(
    f"sqlite:///{db_path}",
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
)

# Create session factory
SessionFactory = sessionmaker(bind=engine)

# Create thread-safe session
Session = scoped_session(SessionFactory)


def get_db_session():
    """Get a database session from the connection pool."""
    return Session()


def get_db_connection():
    """Get a direct database connection using sqlite3."""
    return sqlite3.connect(db_path)


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
                id BIGINT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                id BIGINT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                max_user_submissions INT NOT NULL DEFAULT 1,
                max_points INT NOT NULL,
                is_public BOOLEAN NOT NULL DEFAULT FALSE,
                campaign_context TEXT,
                job_description TEXT,
                created_by BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
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
                id BIGINT PRIMARY KEY,
                campaign_id BIGINT NOT NULL,
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                scoring_prompt TEXT NOT NULL,
                max_points INT NOT NULL,
                order_index INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
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
                id BIGINT PRIMARY KEY,
                campaign_id BIGINT NOT NULL,
                user_id BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP DEFAULT NULL,
                is_complete BOOLEAN NOT NULL DEFAULT FALSE,
                total_points INT DEFAULT NULL,
                resume_path VARCHAR(255) DEFAULT NULL,
                resume_text TEXT DEFAULT NULL,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
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
                id BIGINT PRIMARY KEY,
                submission_id BIGINT NOT NULL,
                question_id BIGINT NOT NULL,
                video_path VARCHAR(255) DEFAULT NULL,
                transcript TEXT NOT NULL,
                score INT DEFAULT NULL,
                score_rationale TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (submission_id) REFERENCES submissions(id),
                FOREIGN KEY (question_id) REFERENCES questions(id),
                UNIQUE (submission_id, question_id)
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
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if columns exist using SQLite's PRAGMA
        cursor.execute("PRAGMA table_info(submissions)")
        columns = [row[1] for row in cursor.fetchall()]  # Column names are in index 1

        # Add resume_path if it doesn't exist
        if "resume_path" not in columns:
            cursor.execute(
                "ALTER TABLE submissions ADD COLUMN resume_path VARCHAR(255) DEFAULT NULL"
            )
            print("Added resume_path column to submissions table")

        # Add resume_text if it doesn't exist
        if "resume_text" not in columns:
            cursor.execute(
                "ALTER TABLE submissions ADD COLUMN resume_text TEXT DEFAULT NULL"
            )
            print("Added resume_text column to submissions table")

        conn.commit()
        print("Migrations completed successfully")
    finally:
        conn.close()


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
