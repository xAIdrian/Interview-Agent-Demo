"""Database migrations package for ensuring database schema is up to date"""

from .alter_submissions_total_points import migrate as alter_submissions_total_points

def run_migrations():
    """Run all migrations in the correct order"""
    # Add migrations in the order they should be run
    alter_submissions_total_points() 