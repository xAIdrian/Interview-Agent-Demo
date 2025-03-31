from flask import Flask, jsonify, request
from flask_cors import CORS
from livekit.interview_api import DatabaseDriver, Candidate
from database import create_db_engine, get_db_session
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
import logging
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define database path
DB_PATH = os.path.join(os.path.dirname(__file__), "livekit/interview_db.sqlite")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Initialize Flask app
app = Flask(__name__)

# Configure CORS
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
            "supports_credentials": True,
            "allow_headers": [
                "Content-Type",
                "Authorization",
                "Accept",
                "x-retry-count",
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        }
    },
)

# Create database engine
engine = create_db_engine(DATABASE_URL)
SessionLocal = get_db_session(engine)


def get_db() -> Session:
    """Get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.route("/health", methods=["GET", "HEAD", "OPTIONS"])
def health_check():
    """Simple health check endpoint."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})
    return jsonify({"status": "ok", "message": "Interview API is operational"})


@app.route("/api/candidates", methods=["GET"])
def get_candidates():
    """Get all available candidate profiles with their interview questions."""
    try:
        with Session(engine) as session:
            # Get all candidates
            result = session.execute(
                text("SELECT email, name, position, experience FROM candidates")
            )
            candidates = result.fetchall()

            # For each candidate, get their questions
            candidates_with_questions = []
            for candidate in candidates:
                email, name, position, experience = candidate

                # Get technical questions
                tech_result = session.execute(
                    text(
                        "SELECT question FROM questions WHERE position = :position AND stage = :stage"
                    ),
                    {"position": position.lower(), "stage": "technical_questions"},
                )
                technical_questions = [row[0] for row in tech_result.fetchall()]

                # Get behavioral questions
                beh_result = session.execute(
                    text(
                        "SELECT question FROM questions WHERE position = :position AND stage = :stage"
                    ),
                    {"position": position.lower(), "stage": "behavioral_questions"},
                )
                behavioral_questions = [row[0] for row in beh_result.fetchall()]

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

            return jsonify(candidates_with_questions)
    except Exception as e:
        logger.error(f"Error fetching candidates: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidates/<email>", methods=["GET"])
def get_candidate(email):
    """Get a specific candidate's profile by email."""
    try:
        with Session(engine) as session:
            result = session.execute(
                text(
                    "SELECT email, name, position, experience FROM candidates WHERE email = :email"
                ),
                {"email": email},
            )
            candidate = result.fetchone()

            if not candidate:
                return jsonify({"error": "Candidate not found"}), 404

            return jsonify(
                {
                    "email": candidate[0],
                    "name": candidate[1],
                    "position": candidate[2],
                    "experience": candidate[3],
                }
            )
    except Exception as e:
        logger.error(f"Error fetching candidate {email}: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidates", methods=["POST"])
def create_candidate():
    """Create a new candidate profile."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ["email", "name", "position", "experience"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        with Session(engine) as session:
            try:
                session.execute(
                    text(
                        "INSERT INTO candidates (email, name, position, experience) VALUES (:email, :name, :position, :experience)"
                    ),
                    {
                        "email": data["email"],
                        "name": data["name"],
                        "position": data["position"],
                        "experience": data["experience"],
                    },
                )
                session.commit()
            except Exception as e:
                session.rollback()
                if "UNIQUE constraint failed" in str(e):
                    # Update existing candidate
                    session.execute(
                        text(
                            "UPDATE candidates SET name = :name, position = :position, experience = :experience WHERE email = :email"
                        ),
                        {
                            "name": data["name"],
                            "position": data["position"],
                            "experience": data["experience"],
                            "email": data["email"],
                        },
                    )
                    session.commit()
                else:
                    raise

            return (
                jsonify(
                    {
                        "message": "Candidate created successfully",
                        "candidate": {
                            "email": data["email"],
                            "name": data["name"],
                            "position": data["position"],
                            "experience": data["experience"],
                        },
                    }
                ),
                201,
            )
    except Exception as e:
        logger.error(f"Error creating candidate: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidates/<email>/questions", methods=["GET"])
def get_candidate_questions(email):
    """Get interview questions for a specific candidate based on their position."""
    try:
        with Session(engine) as session:
            # Get candidate position
            result = session.execute(
                text("SELECT position FROM candidates WHERE email = :email"),
                {"email": email},
            )
            candidate = result.fetchone()

            if not candidate:
                return jsonify({"error": "Candidate not found"}), 404

            position = candidate[0].lower()

            # Get technical questions
            tech_result = session.execute(
                text(
                    "SELECT question FROM questions WHERE position = :position AND stage = :stage"
                ),
                {"position": position, "stage": "technical_questions"},
            )
            technical_questions = [row[0] for row in tech_result.fetchall()]

            # Get behavioral questions
            beh_result = session.execute(
                text(
                    "SELECT question FROM questions WHERE position = :position AND stage = :stage"
                ),
                {"position": position, "stage": "behavioral_questions"},
            )
            behavioral_questions = [row[0] for row in beh_result.fetchall()]

            return jsonify(
                {
                    "technical_questions": technical_questions,
                    "behavioral_questions": behavioral_questions,
                }
            )
    except Exception as e:
        logger.error(f"Error fetching questions for candidate {email}: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidates/<email>/interview", methods=["GET"])
def get_candidate_interview_data(email):
    """Get all interview data for a candidate in a single request."""
    try:
        with Session(engine) as session:
            # Get candidate profile
            result = session.execute(
                text(
                    "SELECT email, name, position, experience FROM candidates WHERE email = :email"
                ),
                {"email": email},
            )
            candidate = result.fetchone()

            if not candidate:
                return jsonify({"error": "Candidate not found"}), 404

            position = candidate[2].lower()

            # Get technical questions
            tech_result = session.execute(
                text(
                    "SELECT question FROM questions WHERE position = :position AND stage = :stage"
                ),
                {"position": position, "stage": "technical_questions"},
            )
            technical_questions = [row[0] for row in tech_result.fetchall()]

            # Get behavioral questions
            beh_result = session.execute(
                text(
                    "SELECT question FROM questions WHERE position = :position AND stage = :stage"
                ),
                {"position": position, "stage": "behavioral_questions"},
            )
            behavioral_questions = [row[0] for row in beh_result.fetchall()]

            return jsonify(
                {
                    "candidate": {
                        "email": candidate[0],
                        "name": candidate[1],
                        "position": candidate[2],
                        "experience": candidate[3],
                    },
                    "questions": {
                        "technical_questions": technical_questions,
                        "behavioral_questions": behavioral_questions,
                    },
                }
            )
    except Exception as e:
        logger.error(f"Error fetching interview data for candidate {email}: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    logger.info("Starting Interview Server...")
    app.run(debug=True, port=5001)
