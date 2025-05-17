import sqlite3
import os
from datetime import datetime


def run_migration():
    # Get the database path
    db_path = os.path.join(os.path.dirname(__file__), "..", "interview_agent.db")

    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Start transaction
        cursor.execute("BEGIN TRANSACTION")

        # Add new columns to campaigns table if they don't exist
        new_columns = [
            "position",
            "location",
            "work_mode",
            "education_level",
            "experience",
            "salary",
            "contract",
        ]

        # Check which columns already exist
        cursor.execute("PRAGMA table_info(campaigns)")
        existing_columns = [column[1] for column in cursor.fetchall()]

        # Add missing columns
        for column in new_columns:
            if column not in existing_columns:
                cursor.execute(
                    f"ALTER TABLE campaigns ADD COLUMN {column} VARCHAR(255) DEFAULT ''"
                )

        # Update existing records with placeholder values
        cursor.execute(
            """
            UPDATE campaigns 
            SET 
                position = CASE 
                    WHEN position = '' THEN 'Not Specified'
                    ELSE position 
                END,
                location = CASE 
                    WHEN location = '' THEN 'Not Specified'
                    ELSE location 
                END,
                work_mode = CASE 
                    WHEN work_mode = '' THEN 'Not Specified'
                    ELSE work_mode 
                END,
                education_level = CASE 
                    WHEN education_level = '' THEN 'Not Specified'
                    ELSE education_level 
                END,
                experience = CASE 
                    WHEN experience = '' THEN 'Not Specified'
                    ELSE experience 
                END,
                salary = CASE 
                    WHEN salary = '' THEN 'Not Specified'
                    ELSE salary 
                END,
                contract = CASE 
                    WHEN contract = '' THEN 'Not Specified'
                    ELSE contract 
                END
            WHERE 
                position = '' OR 
                location = '' OR 
                work_mode = '' OR 
                education_level = '' OR 
                experience = '' OR 
                salary = '' OR 
                contract = ''
        """
        )

        # Create a migration record
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Record this migration
        cursor.execute(
            "INSERT INTO migrations (name) VALUES (?)", ("add_campaign_details",)
        )

        # Commit the transaction
        conn.commit()
        print("Migration completed successfully!")

    except Exception as e:
        # Rollback in case of error
        conn.rollback()
        print(f"Error during migration: {str(e)}")
        raise e

    finally:
        # Close the connection
        conn.close()


if __name__ == "__main__":
    run_migration()
