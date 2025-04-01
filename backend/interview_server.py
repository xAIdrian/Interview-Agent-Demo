from flask import Flask, jsonify, request
from flask_cors import CORS
from livekit.interview_api import DatabaseDriver
import sqlite3
import os
import logging
from livekit.token_server import LiveKitTokenServer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define database path
DB_PATH = os.path.join(os.path.dirname(__file__), "livekit/interview_db.sqlite")

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

# Initialize database driver
db = DatabaseDriver()


@app.route("/health", methods=["GET", "HEAD", "OPTIONS"])
def health_check():
    """Simple health check endpoint."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})
    return jsonify({"status": "ok", "message": "Interview API is operational"})


@app.route("/api/livekit/token", methods=["GET", "OPTIONS"])
def get_livekit_token():
    """Generate and return a LiveKit token for joining a room"""
    if request.method == "OPTIONS":
        # Handle preflight request
        response = jsonify({"status": "ok"})
        # Let the global CORS middleware handle the headers
        return response, 200

    # Get parameters from the request
    name = request.args.get("name", "anonymous")
    room = request.args.get("room")

    try:
        # Generate room name if not provided
        if not room:
            # Use synchronous call since this is not an async function
            import uuid

            room = f"interview-{str(uuid.uuid4())[:8]}"

        # Generate token
        token = LiveKitTokenServer.generate_token(name, room)

        # Create response without explicit CORS headers (let global middleware handle it)
        response = jsonify({"token": token, "room": room})
        return response, 200
    except Exception as e:
        app.logger.error(f"Error generating LiveKit token: {str(e)}")
        error_response = jsonify({"error": str(e)})
        return error_response, 500


@app.route("/api/candidates", methods=["GET"])
def get_candidates():
    """Get all available candidate profiles with their interview questions."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Get all candidates
        cursor.execute("SELECT email, name, position, experience FROM candidates")
        candidates = cursor.fetchall()

        # For each candidate, get their questions
        candidates_with_questions = []
        for candidate in candidates:
            email, name, position, experience = candidate

            # Get technical questions
            cursor.execute(
                "SELECT question FROM questions WHERE position = ? AND stage = ?",
                (position.lower(), "technical_questions"),
            )
            technical_questions = [row[0] for row in cursor.fetchall()]

            # Get behavioral questions
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

        conn.close()

        return jsonify(candidates_with_questions)
    except Exception as e:
        logger.error(f"Error fetching candidates: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidates/<email>", methods=["GET"])
def get_candidate(email):
    """Get a specific candidate's profile by email."""
    try:
        candidate = db.get_candidate_by_email(email)
        if not candidate:
            return jsonify({"error": "Candidate not found"}), 404

        return jsonify(
            {
                "email": candidate.email,
                "name": candidate.name,
                "position": candidate.position,
                "experience": candidate.experience,
            }
        )
    except Exception as e:
        logger.error(f"Error fetching candidate {email}: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidates/<email>/questions", methods=["GET"])
def get_candidate_questions(email):
    """Get interview questions for a specific candidate based on their position."""
    try:
        candidate = db.get_candidate_by_email(email)
        if not candidate:
            return jsonify({"error": "Candidate not found"}), 404

        # Get technical questions
        technical_questions = db.get_questions_for_position_and_stage(
            candidate.position, "technical_questions"
        )

        # Get behavioral questions
        behavioral_questions = db.get_questions_for_position_and_stage(
            candidate.position, "behavioral_questions"
        )

        return jsonify(
            {
                "technical_questions": technical_questions,
                "behavioral_questions": behavioral_questions,
            }
        )
    except Exception as e:
        logger.error(f"Error fetching questions for candidate {email}: {str(e)}")
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

        candidate = db.create_candidate(
            email=data["email"],
            name=data["name"],
            position=data["position"],
            experience=data["experience"],
        )

        return (
            jsonify(
                {
                    "message": "Candidate created successfully",
                    "candidate": {
                        "email": candidate.email,
                        "name": candidate.name,
                        "position": candidate.position,
                        "experience": candidate.experience,
                    },
                }
            ),
            201,
        )
    except Exception as e:
        logger.error(f"Error creating candidate: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/questions", methods=["POST"])
def add_question():
    """Add a new interview question."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ["position", "stage", "question"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        result = db.add_interview_question(
            position=data["position"], stage=data["stage"], question=data["question"]
        )

        return jsonify({"message": result}), 201
    except Exception as e:
        logger.error(f"Error adding question: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidates/<email>/interview", methods=["GET"])
def get_candidate_interview_data(email):
    """Get all interview data for a candidate in a single request."""
    try:
        # Get candidate profile
        candidate = db.get_candidate_by_email(email)
        if not candidate:
            return jsonify({"error": "Candidate not found"}), 404

        # Get technical questions
        technical_questions = db.get_questions_for_position_and_stage(
            candidate.position, "technical_questions"
        )

        # Get behavioral questions
        behavioral_questions = db.get_questions_for_position_and_stage(
            candidate.position, "behavioral_questions"
        )

        return jsonify(
            {
                "candidate": {
                    "email": candidate.email,
                    "name": candidate.name,
                    "position": candidate.position,
                    "experience": candidate.experience,
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
    app.run(
        debug=True, port=5001
    )  # Using port 5001 to avoid conflicts with other services
