from .. import database
import logging


def migrate():
    """Modify total_points column in submissions table to allow NULL values"""
    logger = logging.getLogger(__name__)
    logger.info("Running migration to modify total_points column in submissions table")

    conn = database.get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Check if the table exists
            cursor.execute(
                """
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
                AND table_name = 'submissions'
            """
            )
            if cursor.fetchone()[0] == 0:
                logger.info("Submissions table doesn't exist yet, skipping migration")
                return

            # Modify the total_points column to allow NULL values
            cursor.execute(
                """
                ALTER TABLE submissions
                MODIFY COLUMN total_points INT DEFAULT NULL
            """
            )

            logger.info(
                "Successfully modified total_points column to allow NULL values"
            )

        conn.commit()
        logger.info("Migration completed successfully")

    except Exception as e:
        logger.error(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    migrate()
