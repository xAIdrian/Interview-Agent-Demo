import uuid
import string
import random
from typing import Optional, Tuple


class AccessCodeManager:
    def __init__(self, db_connection):
        self.conn = db_connection
        self.cursor = self.conn.cursor()

    def generate_access_code(self, length: int = 8) -> str:
        """Generate a random access code of specified length."""
        characters = string.ascii_uppercase + string.digits
        return "".join(random.choice(characters) for _ in range(length))

    def create_access_code(self, campaign_id: str) -> str:
        """
        Create a new access code for a campaign.
        Returns the access code.
        """
        access_code = self.generate_access_code()

        self.cursor.execute(
            """
            INSERT INTO campaign_access_codes (id, campaign_id, access_code)
            VALUES (?, ?, ?)
        """,
            (str(uuid.uuid4()), campaign_id, access_code),
        )

        self.conn.commit()
        return access_code

    def validate_access_code(self, campaign_id: str, access_code: str) -> bool:
        """
        Validate an access code for a campaign.
        Returns True if code is valid and not used.
        """
        self.cursor.execute(
            """
            SELECT id 
            FROM campaign_access_codes 
            WHERE campaign_id = ? AND access_code = ? AND is_used = FALSE
        """,
            (campaign_id, access_code),
        )

        return self.cursor.fetchone() is not None

    def mark_code_as_used(self, campaign_id: str, access_code: str) -> bool:
        """Mark an access code as used."""
        self.cursor.execute(
            """
            UPDATE campaign_access_codes 
            SET is_used = TRUE, used_at = CURRENT_TIMESTAMP
            WHERE campaign_id = ? AND access_code = ?
        """,
            (campaign_id, access_code),
        )

        self.conn.commit()
        return self.cursor.rowcount > 0

    def delete_campaign_codes(self, campaign_id: str) -> int:
        """
        Delete all access codes for a campaign.
        Returns number of codes deleted.
        """
        self.cursor.execute(
            """
            DELETE FROM campaign_access_codes 
            WHERE campaign_id = ?
        """,
            (campaign_id,),
        )

        deleted_count = self.cursor.rowcount
        self.conn.commit()
        return deleted_count

    def cleanup_expired_codes(self) -> int:
        """
        Delete all expired access codes.
        Returns number of codes deleted.
        """
        self.cursor.execute(
            """
            DELETE FROM campaign_access_codes 
            WHERE expires_at < CURRENT_TIMESTAMP
        """
        )

        deleted_count = self.cursor.rowcount
        self.conn.commit()
        return deleted_count
