from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import QueuePool
from config import Config
import sqlite3
import os
import datetime

# Create SQLAlchemy engine with connection pooling for SQLite
db_path = os.path.join(os.path.dirname(__file__), "interview_agent.db")
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


def build_filter_query(filters):
    """Build a WHERE clause for SQL queries with proper parameter handling."""
    if not filters:
        return "", {}

    conditions = []
    params = {}

    for key, value in filters.items():
        if value is not None:  # Only add conditions for non-null values
            conditions.append(f"{key} = ?")
            params[key] = value

    if not conditions:
        return "", {}

    return "WHERE " + " AND ".join(conditions), params


def create_users_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255),
                is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                phone_number VARCHAR(20) DEFAULT NULL,
                country_code VARCHAR(10) DEFAULT NULL,
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
                id TEXT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                max_user_submissions INT NOT NULL DEFAULT 1,
                max_points INT NOT NULL DEFAULT 0,
                is_public BOOLEAN NOT NULL DEFAULT FALSE,
                campaign_context TEXT,
                job_description TEXT,
                created_by TEXT,
                position VARCHAR(255),
                location VARCHAR(255),
                work_mode VARCHAR(255),
                education_level VARCHAR(255),
                experience VARCHAR(255),
                salary VARCHAR(255),
                contract VARCHAR(255),
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
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
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
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
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
                id TEXT PRIMARY KEY,
                submission_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
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


def create_campaign_assignments_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS campaign_assignments (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE (campaign_id, user_id)
            )
        """
            )
        )
        session.commit()
    finally:
        session.close()


def create_resume_analysis_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS resume_analysis (
                id TEXT PRIMARY KEY,
                submission_id TEXT NOT NULL,
                strengths TEXT,
                weaknesses TEXT,
                overall_fit TEXT,
                percent_match FLOAT,
                percent_match_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
            )
        """
            )
        )
        session.execute(
            text(
                """
            CREATE INDEX IF NOT EXISTS idx_resume_analysis_submission_id 
            ON resume_analysis(submission_id)
        """
            )
        )
        session.commit()
    finally:
        session.close()


def create_campaign_access_codes_table():
    session = get_db_session()
    try:
        session.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS campaign_access_codes (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                access_code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_used BOOLEAN NOT NULL DEFAULT FALSE,
                used_at TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
                UNIQUE (campaign_id, access_code)
            )
        """
            )
        )
        # Create indexes for faster lookups
        session.execute(
            text(
                """
            CREATE INDEX IF NOT EXISTS idx_campaign_access_codes_campaign_id 
            ON campaign_access_codes(campaign_id)
        """
            )
        )
        session.execute(
            text(
                """
            CREATE INDEX IF NOT EXISTS idx_campaign_access_codes_access_code 
            ON campaign_access_codes(access_code)
        """
            )
        )
        session.commit()
    finally:
        session.close()


def migrate_campaigns_table_id_type():
    """Convert the campaigns table ID columns from BIGINT to TEXT"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Create a new campaigns table with TEXT IDs
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS campaigns_new (
                id TEXT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                max_user_submissions INT NOT NULL DEFAULT 1,
                max_points INT NOT NULL DEFAULT 0,
                is_public BOOLEAN NOT NULL DEFAULT FALSE,
                campaign_context TEXT,
                job_description TEXT,
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        """
        )

        # Copy data from old table to new table, converting IDs to TEXT
        cursor.execute(
            """
            INSERT OR IGNORE INTO campaigns_new 
            SELECT CAST(id AS TEXT), title, max_user_submissions, max_points, 
                   is_public, campaign_context, job_description, 
                   CAST(created_by AS TEXT), created_at, updated_at
            FROM campaigns
        """
        )

        # Drop the old table
        cursor.execute("DROP TABLE IF EXISTS campaigns")

        # Rename the new table to campaigns
        cursor.execute("ALTER TABLE campaigns_new RENAME TO campaigns")

        conn.commit()
        print("Successfully migrated campaigns table to use TEXT IDs")
    except Exception as e:
        print(f"Error migrating campaigns table: {str(e)}")
        conn.rollback()
    finally:
        conn.close()


def migrate_campaigns_add_details():
    """Add new campaign details fields to the campaigns table"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Add new columns if they don't exist
        new_columns = [
            ("position", "VARCHAR(255)"),
            ("location", "VARCHAR(255)"),
            ("work_mode", "VARCHAR(255)"),
            ("education_level", "VARCHAR(255)"),
            ("experience", "VARCHAR(255)"),
            ("salary", "VARCHAR(255)"),
            ("contract", "VARCHAR(255)"),
        ]

        for column_name, column_type in new_columns:
            cursor.execute(f"PRAGMA table_info(campaigns)")
            columns = [row[1] for row in cursor.fetchall()]

            if column_name not in columns:
                cursor.execute(
                    f"ALTER TABLE campaigns ADD COLUMN {column_name} {column_type}"
                )
                print(f"Added {column_name} column to campaigns table")

        conn.commit()
        print("Successfully migrated campaigns table to include new details fields")
    except Exception as e:
        print(f"Error migrating campaigns table: {str(e)}")
        conn.rollback()
    finally:
        conn.close()


def create_tables():
    create_users_table()
    create_campaigns_table()
    create_questions_table()
    create_submissions_table()
    create_submission_answers_table()
    create_campaign_assignments_table()
    create_resume_analysis_table()
    create_campaign_access_codes_table()
    migrate_campaigns_table_id_type()
    migrate_submissions_table_add_resume_columns()
    migrate_campaigns_add_details()


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
    Map a database row to a dictionary, ensuring ID columns are strings and handling datetime values.

    Args:
        row: Database row (tuple)
        columns: List of column names
        string_id_columns: List of column names that should be treated as strings
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
            "created_by",
        ]

    # Columns that should always be strings
    string_columns = string_id_columns + ["phone_number", "country_code"]

    result = {}
    for i, column in enumerate(columns):
        if i < len(row):
            value = row[i]
            # Convert datetime to string if it's a datetime object
            if isinstance(value, (datetime.datetime, datetime.date)):
                value = value.isoformat()
            # For string columns, ensure the value is a string if it's not None
            elif column in string_columns and value is not None:
                value = str(value)
            result[column] = value

    return result
