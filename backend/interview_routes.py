from flask import Blueprint, jsonify, request
from flask_cors import CORS
from livekit.interview_api import DatabaseDriver, InterviewError
import sqlite3
import os
import logging
from livekit.token_server import LiveKitTokenServer
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import timedelta
from werkzeug.exceptions import HTTPException

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define database path
DB_PATH = os.path.join(os.path.dirname(__file__), "livekit/interview_db.sqlite")

# Create blueprint
interview_bp = Blueprint("interview", __name__)

# Initialize database driver
db = DatabaseDriver()


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


@interview_bp.route("/livekit/token", methods=["GET", "OPTIONS"])
def get_livekit_token():
    """Generate and return a LiveKit token for joining a room"""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

    try:
        name = request.args.get("name", "anonymous")
        room = request.args.get("room")

        if not room:
            import uuid

            room = f"interview-{str(uuid.uuid4())[:8]}"

        token = LiveKitTokenServer.generate_token(name, room)
        return jsonify({"token": token, "room": room}), 200
    except Exception as e:
        logger.error(f"Error generating LiveKit token: {str(e)}")
        raise InterviewError(
            "Failed to generate interview token",
            code="TOKEN_GENERATION_ERROR",
            details=str(e),
            status_code=500,
        )


@interview_bp.route("/candidates", methods=["GET"])
def get_candidates():
    """Get all available candidate profiles with their interview questions."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("SELECT email, name, position, experience FROM candidates")
        candidates = cursor.fetchall()

        candidates_with_questions = []
        for candidate in candidates:
            email, name, position, experience = candidate

            try:
                cursor.execute(
                    "SELECT question FROM questions WHERE position = ? AND stage = ?",
                    (position.lower(), "technical_questions"),
                )
                technical_questions = [row[0] for row in cursor.fetchall()]

                cursor.execute(
                    "SELECT question FROM questions WHERE position = ? AND stage = ?",
                    (position.lower(), "behavioral_questions"),
                )
                behavioral_questions = [row[0] for row in cursor.fetchall()]

                candidates_with_questions.append(
                    {
                        "email": email,
                        "name": name,
                        "position": position,
                        "experience": experience,
                        "questions": {
                            "technical_questions": technical_questions,
                            "behavioral_questions": behavioral_questions,
                        },
                    }
                )
            except sqlite3.Error as e:
                logger.error(
                    f"Error fetching questions for candidate {email}: {str(e)}"
                )
                continue

        conn.close()
        return jsonify(candidates_with_questions)
    except sqlite3.Error as e:
        logger.error(f"Database error: {str(e)}")
        raise InterviewError(
            "Failed to fetch candidates",
            code="DATABASE_ERROR",
            details=str(e),
            status_code=500,
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise InterviewError(
            "An unexpected error occurred",
            code="UNEXPECTED_ERROR",
            details=str(e),
            status_code=500,
        )


@interview_bp.route("/candidates/<email>", methods=["GET"])
def get_candidate(email):
    """Get a specific candidate's profile by email."""
    try:
        candidate = db.get_candidate_by_email(email)
        if not candidate:
            raise InterviewError(
                "Candidate not found", code="CANDIDATE_NOT_FOUND", status_code=404
            )

        return jsonify(
            {
                "email": candidate.email,
                "name": candidate.name,
                "position": candidate.position,
                "experience": candidate.experience,
            }
        )
    except InterviewError:
        raise
    except Exception as e:
        logger.error(f"Error fetching candidate {email}: {str(e)}")
        raise InterviewError(
            "Failed to fetch candidate details",
            code="FETCH_ERROR",
            details=str(e),
            status_code=500,
        )


@interview_bp.route("/candidates/<email>/questions", methods=["GET"])
def get_candidate_questions(email):
    """Get interview questions for a specific candidate based on their position."""
    try:
        candidate = db.get_candidate_by_email(email)
        if not candidate:
            raise InterviewError(
                "Candidate not found", code="CANDIDATE_NOT_FOUND", status_code=404
            )

        return jsonify(candidate.get_questions())
    except InterviewError:
        raise
    except Exception as e:
        logger.error(f"Error fetching questions for {email}: {str(e)}")
        raise InterviewError(
            "Failed to fetch questions",
            code="FETCH_ERROR",
            details=str(e),
            status_code=500,
        )
