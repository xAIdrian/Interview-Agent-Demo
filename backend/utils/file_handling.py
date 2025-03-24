import os
import time
import tempfile
from functools import wraps
import logging

logger = logging.getLogger(__name__)

def safe_delete(file_path, max_attempts=3, delay=0.5):
    """
    Safely delete a file with multiple attempts and error handling.
    
    Args:
        file_path: Path to the file to delete
        max_attempts: Maximum number of deletion attempts
        delay: Delay between attempts in seconds
    
    Returns:
        bool: True if deleted successfully, False otherwise
    """
    for attempt in range(max_attempts):
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
            return True
        except PermissionError:
            if attempt < max_attempts - 1:
                logger.info(f"File {file_path} is locked. Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                logger.warning(f"Could not delete {file_path} after {max_attempts} attempts.")
                return False
        except Exception as e:
            logger.error(f"Error deleting {file_path}: {str(e)}")
            return False

class SafeTemporaryFile:
    """A wrapper around tempfile.NamedTemporaryFile that handles safe cleanup."""
    
    def __init__(self, *args, **kwargs):
        # Set delete=False to prevent auto-deletion that can cause issues
        kwargs['delete'] = False
        self.temp_file = tempfile.NamedTemporaryFile(*args, **kwargs)
        
    def __enter__(self):
        return self.temp_file
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            self.temp_file.close()
        except Exception as e:
            logger.error(f"Error closing temporary file: {str(e)}")
        
        # Don't attempt deletion immediately, as other processes might still be using the file
        # We'll let the application or OS clean it up later
        
    @property
    def name(self):
        return self.temp_file.name
        
    def close_and_delete(self):
        """Explicitly close and delete the file when it's safe to do so."""
        try:
            self.temp_file.close()
            safe_delete(self.temp_file.name)
        except Exception as e:
            logger.error(f"Error in close_and_delete: {str(e)}")
