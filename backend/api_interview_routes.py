from flask import Flask, jsonify, request
from flask_cors import CORS
from livekit.interview_api import InterviewError
import logging
from livekit.token_server import LiveKitTokenServer
import multiprocessing
from datetime import timedelta
from werkzeug.exceptions import HTTPException
from flask import Blueprint
from database import get_db_connection, map_row_to_dict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gunicorn configuration
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gevent"
worker_connections = 1000
timeout = 120  # Increased for long-running interview operations
keepalive = 2
max_requests = 1000
max_requests_jitter = 50
graceful_timeout = 30
preload_app = True

interview_bp = Blueprint("interview", __name__)


# Configure logging for Gunicorn
accesslog = "-"  # Log to stdout
errorlog = "-"  # Log to stderr
loglevel = "info"


# Error handlers
@interview_bp.errorhandler(InterviewError)
def handle_interview_error(error):
    logger.error(f"Interview error: {str(error)}")
    return (
        jsonify({"error": str(error), "code": error.code, "details": error.details}),
        error.status_code,
    )


@interview_bp.errorhandler(HTTPException)
def handle_http_error(error):
    logger.error(f"HTTP error: {str(error)}")
    return jsonify({"error": error.description, "code": error.code}), error.code


@interview_bp.errorhandler(Exception)
def handle_generic_error(error):
    logger.error(f"Unexpected error: {str(error)}")
    return jsonify({"error": "An unexpected error occurred", "code": 500}), 500


@interview_bp.route("/health", methods=["GET", "HEAD", "OPTIONS"])
def health_check():
    """Simple health check endpoint."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})
    return jsonify({"status": "ok", "message": "Interview API is operational"})


@interview_bp.route("/campaigns/<campaignId>", methods=["GET"])
def get_campaign(campaignId):
    """Get campaign details and associated questions."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get campaign details
        cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaignId,))
        campaign = cursor.fetchone()

        if not campaign:
            conn.close()
            return jsonify({"error": "Campaign not found"}), 404

        # Get campaign columns
        cursor.execute("PRAGMA table_info(campaigns)")
        columns = [row[1] for row in cursor.fetchall()]
        campaign_data = map_row_to_dict(campaign, columns)

        # Get questions for this campaign
        cursor.execute("SELECT * FROM questions WHERE campaign_id = ?", (campaignId,))
        questions = cursor.fetchall()

        if questions:
            cursor.execute("PRAGMA table_info(questions)")
            question_columns = [row[1] for row in cursor.fetchall()]
            campaign_data["questions"] = [
                map_row_to_dict(q, question_columns) for q in questions
            ]
        else:
            campaign_data["questions"] = []

        conn.close()
        return jsonify(campaign_data)
    except Exception as e:
        logger.error(f"Error fetching campaign: {str(e)}")
        return jsonify({"error": f"Error fetching campaign: {str(e)}"}), 500


@interview_bp.route("/campaigns/<campaignId>/questions", methods=["GET"])
def get_campaign_questions(campaignId):
    """Get all questions for a specific campaign."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify campaign exists
        cursor.execute("SELECT id FROM campaigns WHERE id = ?", (campaignId,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Campaign not found"}), 404

        # Get questions
        cursor.execute("SELECT * FROM questions WHERE campaign_id = ?", (campaignId,))
        questions = cursor.fetchall()

        if questions:
            cursor.execute("PRAGMA table_info(questions)")
            columns = [row[1] for row in cursor.fetchall()]
            questions_data = [map_row_to_dict(q, columns) for q in questions]
        else:
            questions_data = []

        conn.close()
        return jsonify(questions_data)
    except Exception as e:
        logger.error(f"Error fetching campaign questions: {str(e)}")
        return jsonify({"error": f"Error fetching campaign questions: {str(e)}"}), 500


@interview_bp.route("/campaigns/<campaignId>/start", methods=["POST"])
def start_campaign_interview(campaignId):
    """Start an interview for a specific campaign."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify campaign exists
        cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaignId,))
        campaign = cursor.fetchone()

        if not campaign:
            conn.close()
            return jsonify({"error": "Campaign not found"}), 404

        # Get campaign columns
        cursor.execute("PRAGMA table_info(campaigns)")
        columns = [row[1] for row in cursor.fetchall()]
        campaign_data = map_row_to_dict(campaign, columns)

        # Get questions
        cursor.execute("SELECT * FROM questions WHERE campaign_id = ?", (campaignId,))
        questions = cursor.fetchall()

        if questions:
            cursor.execute("PRAGMA table_info(questions)")
            question_columns = [row[1] for row in cursor.fetchall()]
            campaign_data["questions"] = [
                map_row_to_dict(q, question_columns) for q in questions
            ]
        else:
            campaign_data["questions"] = []

        conn.close()
        return jsonify(campaign_data)
    except Exception as e:
        logger.error(f"Error starting campaign interview: {str(e)}")
        return jsonify({"error": f"Error starting campaign interview: {str(e)}"}), 500


if __name__ == "__main__":
    # Development server
    logger.info("Starting Interview Server in development mode...")
else:
    # Production server (Gunicorn)
    logger.info("Starting Interview Server in production mode...")
    # Gunicorn will use the 'app' variable
