import sqlite3
import logging
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    """Add phone_number and country_code columns to users table if they don't exist"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Check if columns exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]

        # Add phone_number if it doesn't exist
        if "phone_number" not in columns:
            logger.info("Adding phone_number column to users table")
            cursor.execute(
                "ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL"
            )

        # Add country_code if it doesn't exist
        if "country_code" not in columns:
            logger.info("Adding country_code column to users table")
            cursor.execute(
                "ALTER TABLE users ADD COLUMN country_code VARCHAR(10) DEFAULT NULL"
            )

        conn.commit()
        logger.info("Successfully added phone number fields to users table")

    except Exception as e:
        logger.error(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
