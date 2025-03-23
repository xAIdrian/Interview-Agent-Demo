import mariadb
from config import Config

def build_filter_query(table_name, filters):
    query = f"SELECT * FROM {table_name} WHERE "
    params = []
    conditions = []

    for key, value in filters.items():
        conditions.append(f"{key} = %s")
        params.append(value)

    query += " AND ".join(conditions)
    return query, params

def get_db_connection():
    connection = mariadb.connect(
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        database=Config.DB_NAME
    )
    return connection

def create_users_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
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
        """)
    conn.commit()
    conn.close()

def create_campaigns_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
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
        """)
    conn.commit()
    conn.close()

def create_questions_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
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
        """)
    conn.commit()
    conn.close()

def create_submissions_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
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
        """)
    conn.commit()
    conn.close()

def create_submission_answers_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS submission_answers (
                id BIGINT UNSIGNED PRIMARY KEY,
                submission_id BIGINT UNSIGNED NOT NULL,
                question_id BIGINT UNSIGNED NOT NULL,
                video_path VARCHAR(255) NOT NULL,
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
        """)
    conn.commit()
    conn.close()

def create_tables():
    create_users_table()
    create_campaigns_table()
    create_questions_table()
    create_submissions_table()
    create_submission_answers_table()

def migrate_submissions_table_add_resume_columns():
    """Add resume_path and resume_text columns to the submissions table if they don't exist"""
    conn = get_db_connection()
    with conn.cursor() as cursor:
        # Check if columns exist
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'submissions' 
            AND COLUMN_NAME = 'resume_path'
        """)
        resume_path_exists = cursor.fetchone()[0] > 0
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'submissions' 
            AND COLUMN_NAME = 'resume_text'
        """)
        resume_text_exists = cursor.fetchone()[0] > 0
        
        # Add columns if they don't exist
        if not resume_path_exists:
            cursor.execute("""
                ALTER TABLE submissions
                ADD COLUMN resume_path VARCHAR(255) DEFAULT NULL
            """)
            print("Added resume_path column to submissions table")
            
        if not resume_text_exists:
            cursor.execute("""
                ALTER TABLE submissions
                ADD COLUMN resume_text LONGTEXT DEFAULT NULL
            """)
            print("Added resume_text column to submissions table")
    
    conn.commit()
    conn.close()
    print("Migrations completed successfully")