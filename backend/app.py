from botocore.exceptions import ClientError
from config import Config
from database import (
    get_db_connection,
    create_tables,
    migrate_submissions_table_add_resume_columns,
)
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    jsonify,
    send_file,
)
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import boto3
import os
import random
import string
import tempfile
import uuid
import sqlite3

# Password security constants and utilities
PASSWORD_HASH_METHOD = "pbkdf2:sha256"


def hash_password(password: str) -> str:
    """
    Consistently hash passwords using the same method across the application.
    """
    return generate_password_hash(password, method=PASSWORD_HASH_METHOD)


def verify_password(password_hash: str, password: str) -> bool:
    """
    Verify a password against a hash.
    """
    try:
        return check_password_hash(password_hash, password)
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False


# import whisper
from fpdf import FPDF

from api_routes import api_bp
from scoring_agent import generate_submission_scoring
import os
import tempfile
from create_campaign_from_doc import (
    extract_text_from_file,
    generate_campaign_context,
    generate_interview_questions,
)
from utils.file_handling import SafeTemporaryFile, safe_delete
from flask_cors import CORS
from datetime import timedelta
import secrets
from api_interview_routes import interview_bp


app = Flask(__name__)

# Configure CORS to allow all origins, methods, and headers
CORS(
    app,
    resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
            "allow_headers": ["*"],
            "expose_headers": ["*"],
            "supports_credentials": True,  # Enable credentials support
            "max_age": 3600,
        }
    },
)

app.config.from_object(Config)
app.register_blueprint(api_bp, url_prefix="/api")
app.register_blueprint(interview_bp, url_prefix="/interview")

# Configure the app for proper session handling
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", Config.SECRET_KEY)
app.config["SESSION_TYPE"] = "filesystem"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)  # Extend to 30 days
app.config["SESSION_COOKIE_SECURE"] = False  # Set to True in production with HTTPS
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"  # Use 'Strict' in production
app.config["SESSION_COOKIE_DOMAIN"] = None  # Allow cross-origin cookies


# Make sessions permanent by default
@app.before_request
def make_session_permanent():
    session.permanent = True


# Add a root-level health endpoint
@app.route("/health", methods=["GET", "HEAD", "OPTIONS"])
def health_check():
    """
    Simple health check endpoint to verify the API is running.
    """
    return jsonify({"status": "ok", "message": "API is operational"}), 200


@app.before_first_request
def create_tables_on_startup():
    try:
        create_tables()
        migrate_submissions_table_add_resume_columns()

        # Execute the migration to update total_points to allow NULL
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            # Modify the total_points column to allow NULL values
            cursor.execute(
                """
                ALTER TABLE submissions
                MODIFY COLUMN total_points INT DEFAULT NULL
            """
            )
            print("Successfully modified total_points column to allow NULL values")

            # Update existing submissions with total_points=0 to NULL
            cursor.execute(
                """
                UPDATE submissions 
                SET total_points = NULL 
                WHERE total_points = 0 AND is_complete = FALSE
            """
            )
            print(f"Updated {cursor.rowcount} submissions with total_points=0 to NULL")

            conn.commit()
        except Exception as e:
            print(f"Error during migration: {e}")
            conn.rollback()
        finally:
            conn.close()
    except Exception as e:
        app.logger.error(f"Error during startup database setup: {str(e)}")
        print(f"Error during startup database setup: {e}")
        # Don't crash the application - let it continue even with DB issues
        # The health check will still work, but database operations will fail


@app.route("/register", methods=["POST"])
def register():
    if not request.is_json:
        return (
            jsonify(
                {"success": False, "message": "Content-Type must be application/json"}
            ),
            400,
        )

    data = request.get_json()
    email = data.get("email")
    name = data.get("name", "")
    password = data.get("password")

    if not all([email, name, password]):
        return (
            jsonify(
                {"success": False, "message": "Email, name, and password are required"}
            ),
            400,
        )

    # Use the utility function for password hashing
    hashed_password = hash_password(password)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        sql = "INSERT INTO users (id, email, name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)"
        cursor.execute(
            sql,
            (
                str(uuid.uuid4().int & (1 << 64) - 1),
                email,
                name,
                hashed_password,
                True,  # Set is_admin to True for all new registrations
            ),
        )
        conn.commit()

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Registration successful! Please log in.",
                    "user": {"email": email, "name": name, "is_admin": True},
                    "redirect": "/",  # Add redirect path to home
                }
            ),
            201,
        )

    except sqlite3.Error as e:
        conn.rollback()
        print(f"Database error during registration: {e}")
        return (
            jsonify(
                {"success": False, "message": "An error occurred during registration"}
            ),
            400,
        )
    finally:
        conn.close()


@app.route("/login", methods=["POST"])
def login():
    if not request.is_json:
        return (
            jsonify(
                {"success": False, "message": "Content-Type must be application/json"}
            ),
            400,
        )

    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not all([email, password]):
        return (
            jsonify({"success": False, "message": "Email and password are required"}),
            400,
        )

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.row_factory = sqlite3.Row  # Enable dictionary-like access
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        # First check if user exists
        if not user:
            return (
                jsonify({"success": False, "message": "Invalid email or password"}),
                401,
            )

        # Then safely check password
        try:
            password_hash = user["password_hash"]
            if not password_hash or not verify_password(password_hash, password):
                return (
                    jsonify({"success": False, "message": "Invalid email or password"}),
                    401,
                )
        except (KeyError, TypeError) as e:
            # Log the error internally but don't expose it to the user
            print(f"Error: Invalid password_hash format for user {email}: {e}")
            return (
                jsonify({"success": False, "message": "Invalid email or password"}),
                401,
            )

        # If we get here, both user exists and password is correct
        session["user_id"] = user["id"]
        session["is_admin"] = user["is_admin"]

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Login successful",
                    "user": {
                        "id": user["id"],
                        "email": user["email"],
                        "name": user["name"],
                        "is_admin": user["is_admin"],
                    },
                    "redirect_to": "/admin" if user["is_admin"] else "/candidate",
                }
            ),
            200,
        )

    except sqlite3.Error as e:
        print(f"Database error during login: {e}")
        return (
            jsonify({"success": False, "message": "An error occurred during login"}),
            500,
        )
    finally:
        conn.close()


@app.route("/logout", methods=["GET", "POST"])
def logout():
    # Clear session data
    session.clear()

    # For API requests
    if request.is_json:
        return jsonify({"success": True, "message": "Logged out successfully"}), 200

    # For web UI
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


# Decorator for checking if a user is logged in
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is logged in via session
        if "user_id" not in session:
            # For API requests, return 401
            if (
                request.is_json
                or request.headers.get("Content-Type") == "application/json"
            ):
                return jsonify({"error": "Authentication required"}), 401
            # For web UI, redirect to login
            return redirect(url_for("login"))

        return f(*args, **kwargs)

    return decorated_function


# Decorator to check admin status
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is an admin via session
        if not session.get("is_admin"):
            # For API requests, return 403
            if (
                request.is_json
                or request.headers.get("Content-Type") == "application/json"
            ):
                return jsonify({"error": "Admin privileges required"}), 403
            # For web UI, redirect to home
            return redirect(url_for("index"))

        return f(*args, **kwargs)

    return decorated_function


# Admin UI
@app.route("/admin")
@admin_required
def admin_index():
    return render_template("admin/index.html")


@app.route("/admin/users", methods=["GET"])
@admin_required
def admin_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, is_admin FROM users")
    users = cursor.fetchall()
    conn.close()
    return render_template("admin/users/users.html", users=users)


@app.route("/admin/users/create", methods=["GET", "POST"])
@admin_required
def admin_create_user():
    if request.method == "POST":
        email = request.form.get("email")
        name = request.form.get("name")
        is_admin = request.form.get("is_admin") == "on"

        # Generate a random password
        password = "".join(random.choices(string.ascii_letters + string.digits, k=12))
        hashed_password = hash_password(password)

        conn = get_db_connection()
        cursor = conn.cursor()
        sql = "INSERT INTO users (id, email, name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)"
        cursor.execute(
            sql,
            (
                str(uuid.uuid4().int & (1 << 64) - 1),
                email,
                name,
                hashed_password,
                is_admin,
            ),
        )
        conn.commit()
        conn.close()

        flash(f"User created successfully! The password is: {password}", "success")
        return render_template(
            "admin/users/create_user_confirmation.html", password=password
        )

    return render_template("admin/users/create_user.html")


@app.route("/admin/campaigns")
@admin_required
def admin_campaigns():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM campaigns")
    campaigns = cursor.fetchall()
    conn.close()
    return render_template("admin/campaigns/campaigns_list.html", campaigns=campaigns)


@app.route("/admin/campaigns/create", methods=["GET", "POST"])
@admin_required
def admin_create_campaign():
    if request.method == "POST":
        data = request.get_json()
        print("Data received:", data)
        title = data.get("title")
        is_public = data.get("is_public") == "on"
        max_user_submissions = data.get("max_user_submissions")
        questions = data.get("questions", [])

        conn = get_db_connection()
        cursor = conn.cursor()
        # Insert the new campaign
        cursor.execute(
            "INSERT INTO campaigns (id, title, max_user_submissions, max_points, is_public) VALUES (?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4().int & (1 << 64) - 1),
                title,
                max_user_submissions,
                0,
                is_public,
            ),
        )
        campaign_id = cursor.lastrowid

        total_max_points = 0

        # Insert the questions for the campaign
        for question in questions:
            question_title = question.get("title")
            question_body = question.get("body")
            scoring_prompt = question.get("scoring_prompt")
            max_points = int(question.get("max_points"))
            total_max_points += max_points
            sql_question = """
                INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points)
                VALUES (?, ?, ?, ?, ?, ?)
            """
            cursor.execute(
                sql_question,
                (
                    str(uuid.uuid4().int & (1 << 64) - 1),
                    campaign_id,
                    question_title,
                    question_body,
                    scoring_prompt,
                    max_points,
                ),
            )

        # Update the campaign with the total max points
        sql_update_campaign = "UPDATE campaigns SET max_points = ? WHERE id = ?"
        cursor.execute(sql_update_campaign, (total_max_points, campaign_id))

        conn.commit()
        conn.close()

        return jsonify({"success": True})

    return render_template("admin/campaigns/create_campaign.html")


@app.route("/admin/campaigns/<int:campaign_id>")
@admin_required
def admin_campaign_details(campaign_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get campaign details
    cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
    campaign = cursor.fetchone()

    # Get questions count
    cursor.execute(
        "SELECT COUNT(*) AS count FROM questions WHERE campaign_id = ?",
        (campaign_id,),
    )
    questions_count = cursor.fetchone()["count"]

    # Get submissions count
    cursor.execute(
        "SELECT COUNT(*) AS count FROM submissions WHERE campaign_id = ?",
        (campaign_id,),
    )
    submissions_count = cursor.fetchone()["count"]

    conn.close()

    return render_template(
        "admin/campaigns/campaign.html",
        campaign=campaign,
        questions_count=questions_count,
        submissions_count=submissions_count,
    )


@app.route("/admin/campaigns/<int:campaign_id>/submissions/<int:submission_id>")
@admin_required
def admin_submission_details(campaign_id, submission_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get submission details
    cursor.execute(
        """
    SELECT submissions.*, users.email, campaigns.title AS campaign_name
    FROM submissions
    JOIN users ON submissions.user_id = users.id
    JOIN campaigns ON submissions.campaign_id = campaigns.id
    WHERE submissions.id = ?
    """,
        (submission_id,),
    )
    submission = cursor.fetchone()

    # Get user
    cursor.execute(
        """
    SELECT * FROM USERS
    WHERE id = ?
    """,
        (submission["user_id"],),
    )
    user = cursor.fetchone()

    # Get submission answers
    cursor.execute(
        """
    SELECT submission_answers.*, questions.title AS question_title
    FROM submission_answers
    JOIN questions ON submission_answers.question_id = questions.id
    WHERE submission_answers.submission_id = ?
    """,
        (submission_id,),
    )
    submission_answers = cursor.fetchall()

    conn.close()

    return render_template(
        "admin/campaigns/submission.html",
        campaign_id=campaign_id,
        submission=submission,
        user=user,
        submission_answers=submission_answers,
    )


@app.route("/admin/campaigns/<int:campaign_id>/submissions/<int:submission_id>/edit")
@admin_required
def admin_edit_submission(campaign_id, submission_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get submission details
    cursor.execute(
        """
    SELECT submissions.*, users.email, campaigns.title AS campaign_name
    FROM submissions
    JOIN users ON submissions.user_id = users.id
    JOIN campaigns ON submissions.campaign_id = campaigns.id
    WHERE submissions.id = ?
    """,
        (submission_id,),
    )
    submission = cursor.fetchone()

    # Get submission answers
    cursor.execute(
        """
    SELECT submission_answers.*, questions.title AS question_title
    FROM submission_answers
    JOIN questions ON submission_answers.question_id = questions.id
    WHERE submission_answers.submission_id = ?
    """,
        (submission_id,),
    )
    submission_answers = cursor.fetchall()

    conn.close()

    return render_template(
        "admin/campaigns/edit_submission.html",
        campaign_id=campaign_id,
        submission=submission,
        submission_answers=submission_answers,
    )


@app.route("/admin/campaigns/<int:campaign_id>/edit", methods=["GET"])
@admin_required
def admin_edit_campaign(campaign_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get campaign details
    cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
    campaign = cursor.fetchone()

    if not campaign:
        flash("Campaign not found", "error")
        return redirect(url_for("admin_campaigns"))

    # Get campaign questions
    cursor.execute("SELECT * FROM questions WHERE campaign_id = ?", (campaign_id,))
    questions = cursor.fetchall()

    conn.close()

    return render_template(
        "admin/campaigns/edit_campaign.html", campaign=campaign, questions=questions
    )


# Mock: Example function to get campaign questions from DB
def get_campaign_questions(campaign_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    sql = """
    SELECT id, title, body, scoring_prompt
    FROM questions
    WHERE campaign_id = ?
    """
    cursor.execute(sql, (campaign_id,))
    questions = cursor.fetchall()
    conn.close()
    # Convert id to string
    for question in questions:
        question["id"] = str(question["id"])
    return questions


# Mock: Example function to generate LiveKit token
def generate_livekit_token(campaign_id, candidate_id):
    """
    In real code, you'd use the LiveKit server SDK (or create your own JWT)
    with your LiveKit API key and secret. For now, we return a placeholder.
    """
    return "PLACEHOLDER_LIVEKIT_TOKEN_FOR_DEMO"


@app.route("/interview/<int:campaign_id>")
def interview_room(campaign_id):
    questions = get_campaign_questions(campaign_id)
    # Get the real user_id from the session (assuming the user is logged in)
    user_id = session.get("user_id")

    # Create a new submission in the database and get the submission_id
    # conn = get_db_connection()
    # with conn.cursor() as cursor:
    #     # Check if campaign_id exists
    #     cursor.execute("SELECT id FROM campaigns WHERE id = ?", (campaign_id,))
    #     campaign = cursor.fetchone()
    #     if not campaign:
    #         return jsonify({"error": "Invalid campaign_id"}), 400

    #     submission_id = uuid.uuid4().int >> 64

    #     sql = """
    #     INSERT INTO submissions (id, campaign_id, user_id, created_at, total_points)
    #     VALUES (?, ?, ?, NOW(), ?)
    #     """
    #     try:
    #         cursor.execute(
    #             sql, (submission_id, campaign_id, user_id, 0)
    #         )  # Set total_points to 0 initially

    #     except mariadb.IntegrityError as e:
    #         return jsonify({"error": str(e)}), 400

    # conn.commit()
    # conn.close()

    return jsonify(questions=questions)


# Configure your S3 bucket name (already created)
S3_BUCKET = "gulpin-interviews"

# Initialize S3 client with proper credentials
s3_client = boto3.client(
    "s3",
    aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY=***REMOVED***=***REMOVED***,
    aws_session_token=Config.AWS_SESSION_TOKEN,
    region_name=Config.S3_REGION,
)


@app.route("/submit_answer", methods=["POST"])
def upload_interview():
    """
    Endpoint to receive interview audio/video from the client (e.g., MediaRecorder blob or LiveKit recording),
    upload to S3, then transcribe its audio using Whisper.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    submission_id = request.form.get("submission_id")
    question_id = request.form.get("question_id")

    if not submission_id or not question_id:
        return jsonify({"error": "submission_id and question_id are required"}), 400

    # Generate a unique filename for S3
    extension = os.path.splitext(file.filename)[1].lower()
    unique_id = str(uuid.uuid4())
    s3_filename = f"interviews/{unique_id}{extension}"

    # 1. Save file to a temporary location
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as tmp:
            temp_file_path = tmp.name
            file.save(temp_file_path)

        # 2. Upload local temp file to S3
        try:
            s3_client.upload_file(temp_file_path, S3_BUCKET, s3_filename)
            print(f"Uploaded to S3: {S3_BUCKET}/{s3_filename}")
        except ClientError as e:
            print(f"S3 upload failed: {e}")
            return jsonify({"error": "S3 upload failed"}), 500

        # 3. Run Whisper transcription on the local temp file
        #    (Alternatively, you can re-download from S3 or pass the temp_file_path directly.)
        try:
            model = whisper.load_model("small")  # pick your desired model size
            result = model.transcribe(temp_file_path, fp16=False)  # CPU-based
            transcript_text = result["text"].strip()
            print("=== Whisper Transcript ===")
            print(transcript_text)
            print("=========================")
        except Exception as e:
            print(f"Whisper transcription error: {e}")
            return jsonify({"error": "Transcription failed"}), 500

        # 4. Insert the submission answer into the database
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            sql = """
            INSERT INTO submission_answers (id, submission_id, question_id, video_path, transcript)
            VALUES (?, ?, ?, ?, ?)
            """
            cursor.execute(
                sql,
                (
                    str(uuid.uuid4().int & (1 << 64) - 1),
                    submission_id,
                    question_id,
                    s3_filename,
                    transcript_text,
                ),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Database insertion error: {e}")
            return jsonify({"error": "Database insertion failed"}), 500

        # 5. Clean up local temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

        # 6. Return a success response
        return (
            jsonify(
                {
                    "message": "File uploaded and transcribed successfully!",
                    "s3_key": s3_filename,
                    "transcript": transcript_text,
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error handling file: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/admin/watch_video/<filename>")
@admin_required
def watch_video(filename):
    try:
        s3_key = f"interviews/{filename}"
        video_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=3600,  # URL expiration time in seconds
        )
        return render_template("admin/campaigns/watch_video.html", video_url=video_url)
    except ClientError as e:
        print(f"Error generating presigned URL: {e}")
        return jsonify({"error": "Failed to generate video URL"}), 500


@app.route("/finalize_submission/<int:submission_id>", methods=["POST"])
def finalize_submission(submission_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get submission details
    cursor.execute("SELECT campaign_id FROM submissions WHERE id = ?", (submission_id,))
    submission = cursor.fetchone()
    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    campaign_id = submission["campaign_id"]

    # Get campaign details
    cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
    campaign = cursor.fetchone()
    if not campaign:
        return jsonify({"error": "Campaign not found"}), 404

    # Get questions for the campaign
    cursor.execute("SELECT * FROM questions WHERE campaign_id = ?", (campaign_id,))
    questions = cursor.fetchall()

    # Get submission answers
    cursor.execute(
        """
        SELECT * FROM submission_answers
        WHERE submission_answers.submission_id = ?
    """,
        (submission_id,),
    )
    answers = cursor.fetchall()

    conn.close()

    # Generate scores
    print("Campaign:", campaign)
    print("Questions:", questions)
    print("Answers:", answers)

    scores = generate_submission_scoring(campaign, questions, answers)

    # Update scores and rationales in the database
    total_score = 0
    conn = get_db_connection()
    cursor = conn.cursor()
    for question, score_data in zip(questions, scores):
        answer = next((a for a in answers if a["question_id"] == question["id"]), None)
        if answer:
            cursor.execute(
                """
                UPDATE submission_answers
                SET score = ?, score_rationale = ?
                WHERE id = ?
            """,
                (score_data["score"], score_data["rationale"], answer["id"]),
            )
            total_score += score_data["score"]

    # Update total score in the submissions table
    cursor.execute(
        """
        UPDATE submissions
        SET is_complete = TRUE, total_points = ?
        WHERE id = ?
    """,
        (total_score, submission_id),
    )

    conn.commit()
    conn.close()

    # Print scores
    print(scores)

    return jsonify({"message": "Submission finalized and scores generated"}), 200


@app.route("/admin/submission_report/<int:submission_id>")
@admin_required
def admin_submission_report(submission_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get submission details
    cursor.execute(
        """
        SELECT submissions.*, users.email, users.name AS user_name, 
               campaigns.title AS campaign_name, campaigns.campaign_context
        FROM submissions
        JOIN users ON submissions.user_id = users.id
        JOIN campaigns ON submissions.campaign_id = campaigns.id
        WHERE submissions.id = ?
    """,
        (submission_id,),
    )
    submission = cursor.fetchone()

    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    campaign_id = submission["campaign_id"]

    # Get questions for the campaign
    cursor.execute("SELECT * FROM questions WHERE campaign_id = ?", (campaign_id,))
    questions = cursor.fetchall()

    # Get submission answers
    cursor.execute(
        """
        SELECT submission_answers.*, questions.title AS question_title, questions.body AS question_body, 
               questions.scoring_prompt, questions.max_points
        FROM submission_answers
        JOIN questions ON submission_answers.question_id = questions.id
        WHERE submission_answers.submission_id = ?
    """,
        (submission_id,),
    )
    answers = cursor.fetchall()

    conn.close()

    # Generate PDF report with improved formatting
    class PDF(FPDF):
        def header(self):
            # Set font for header
            self.set_font("Arial", "B", 12)
            # Title
            self.cell(0, 10, f"Candidate Submission Report", 0, 1, "C")
            # Line break
            self.ln(4)

        def footer(self):
            # Position at 1.5 cm from bottom
            self.set_y(-15)
            # Set font for footer
            self.set_font("Arial", "I", 8)
            # Page number
            self.cell(0, 10, f"Page {self.page_no()}", 0, 0, "C")

    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Add submission details section
    pdf.set_font("Arial", "B", 11)
    pdf.cell(0, 10, "Submission Details", 0, 1, "L")
    pdf.set_font("Arial", "", 10)
    pdf.cell(40, 8, "Candidate:", 0, 0)
    pdf.cell(0, 8, f"{submission['user_name']} ({submission['email']})", 0, 1)
    pdf.cell(40, 8, "Campaign:", 0, 0)
    pdf.cell(0, 8, f"{submission['campaign_name']}", 0, 1)
    pdf.cell(40, 8, "Date:", 0, 0)
    pdf.cell(0, 8, f"{submission['created_at']}", 0, 1)
    pdf.cell(40, 8, "Total Score:", 0, 0)
    pdf.cell(0, 8, f"{submission['total_points']} points", 0, 1)

    # Add campaign context
    pdf.ln(5)
    pdf.set_font("Arial", "B", 11)
    pdf.cell(0, 10, "Campaign Context:", 0, 1, "L")
    pdf.set_font("Arial", "", 10)
    pdf.multi_cell(0, 8, f"{submission['campaign_context']}")

    # Add questions and answers
    total_points = 0
    max_total_points = 0

    for i, question in enumerate(questions):
        answer = next((a for a in answers if a["question_id"] == question["id"]), None)
        if answer:
            total_points += answer["score"]
            max_total_points += question["max_points"]

            # Add question section
            pdf.ln(10)
            pdf.set_font("Arial", "B", 11)
            pdf.cell(0, 10, f"Question {i+1}: {question['title']}", 0, 1, "L")

            # Question body
            pdf.set_font("Arial", "B", 10)
            pdf.cell(0, 8, "Question:", 0, 1)
            pdf.set_font("Arial", "", 10)
            pdf.multi_cell(0, 8, f"{question['body']}")

            # Scoring criteria
            pdf.ln(5)
            pdf.set_font("Arial", "B", 10)
            pdf.cell(0, 8, "Scoring Criteria:", 0, 1)
            pdf.set_font("Arial", "", 10)
            pdf.multi_cell(0, 8, f"{question['scoring_prompt']}")

            # Candidate's answer
            pdf.ln(5)
            pdf.set_font("Arial", "B", 10)
            pdf.cell(0, 8, "Candidate's Response:", 0, 1)
            pdf.set_font("Arial", "", 10)
            pdf.multi_cell(0, 8, f"{answer['transcript']}")

            # Score and rationale
            pdf.ln(5)
            pdf.set_font("Arial", "B", 10)
            pdf.cell(40, 8, "Score:", 0, 0)
            pdf.set_font("Arial", "", 10)
            pdf.cell(0, 8, f"{answer['score']} / {question['max_points']} points", 0, 1)

            pdf.set_font("Arial", "B", 10)
            pdf.cell(0, 8, "Score Rationale:", 0, 1)
            pdf.set_font("Arial", "", 10)
            pdf.multi_cell(0, 8, f"{answer['score_rationale']}")

            # Draw a separator line
            pdf.ln(5)
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())

    # Add summary at the end
    pdf.ln(10)
    pdf.set_font("Arial", "B", 11)
    pdf.cell(0, 10, "Summary", 0, 1, "L")
    pdf.set_font("Arial", "", 10)
    pdf.cell(70, 8, "Total Score:", 0, 0)
    pdf.cell(0, 8, f"{total_points} / {max_total_points} points", 0, 1)
    pdf.cell(70, 8, "Percentage Score:", 0, 0)
    percentage = (total_points / max_total_points * 100) if max_total_points > 0 else 0
    pdf.cell(0, 8, f"{percentage:.1f}%", 0, 1)

    # Save PDF to a temporary file
    pdf_output = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    pdf.output(pdf_output.name)

    # Return the PDF file
    return send_file(
        pdf_output.name,
        as_attachment=True,
        download_name=f"candidate_submission_report_{submission_id}.pdf",
    )


@app.route("/")
def index():
    if not session.get("user_id"):
        return redirect(url_for("login"))

    if session.get("is_admin"):
        return redirect(url_for("admin_index"))
    else:
        return render_template("candidate_index.html")


@app.route("/admin/users/<int:user_id>")
@admin_required
def admin_user_details(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get user details
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()

    if not user:
        flash("User not found", "error")
        return redirect(url_for("admin_users"))

    conn.close()

    return render_template("admin/users/user.html", user=user)


@app.route("/admin/users/<int:user_id>/edit", methods=["GET", "POST"])
@admin_required
def admin_edit_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get user details
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()

    if not user:
        flash("User not found", "error")
        return redirect(url_for("admin_users"))

    if request.method == "POST":
        email = request.form.get("email")
        name = request.form.get("name")
        is_admin = request.form.get("is_admin") == "on"
        reset_password = request.form.get("reset_password") == "on"

        update_sql = "UPDATE users SET email = ?, name = ?, is_admin = ? WHERE id = ?"
        update_values = [email, name, is_admin, user_id]

        if reset_password:
            # Generate a new random password
            password = "".join(
                random.choices(string.ascii_letters + string.digits, k=12)
            )
            hashed_password = hash_password(password)
            update_sql = "UPDATE users SET email = ?, name = ?, is_admin = ?, password_hash = ? WHERE id = ?"
            update_values = [email, name, is_admin, hashed_password, user_id]
            flash(
                f"User updated successfully! The new password is: {password}",
                "success",
            )
            return render_template(
                "admin/users/edit_user_confirmation.html", password=password
            )

        cursor.execute(update_sql, update_values)
        conn.commit()
        flash("User updated successfully!", "success")
        return redirect(url_for("admin_user_details", user_id=user_id))

    conn.close()
    return render_template("admin/users/edit_user.html", user=user)


@app.route("/profile")
@login_required
def profile():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],))
    user = cursor.fetchone()
    conn.close()
    return render_template("profile.html", user=user)


@app.route("/edit_profile", methods=["GET", "POST"])
@login_required
def edit_profile():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],))
    user = cursor.fetchone()

    if request.method == "POST":
        name = request.form.get("name")
        email = request.form.get("email")
        current_password = request.form.get("current_password")
        new_password = request.form.get("new_password")
        confirm_password = request.form.get("confirm_password")

        if not verify_password(user["password_hash"], current_password):
            flash("Incorrect current password", "danger")
            return render_template("edit_profile.html", user=user)

        if new_password and new_password != confirm_password:
            flash("New passwords do not match", "danger")
            return render_template("edit_profile.html", user=user)

        update_sql = "UPDATE users SET name = ?, email = ? WHERE id = ?"
        update_values = [name, email, session["user_id"]]

        if new_password:
            hashed_password = hash_password(new_password)
            update_sql = (
                "UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?"
            )
            update_values = [name, email, hashed_password, session["user_id"]]

        cursor.execute(update_sql, update_values)
        conn.commit()
        flash("Profile updated successfully!", "success")
        return redirect(url_for("profile"))

    conn.close()
    return render_template("edit_profile.html", user=user)


@app.route("/admin/campaigns/create-from-doc", methods=["GET", "POST"])
@admin_required
def admin_create_campaign_from_doc():
    if request.method == "POST":
        title = request.form.get("title")
        max_user_submissions = request.form.get("max_user_submissions", 1)
        is_public = request.form.get("is_public") == "on"

        # Get the job description from either uploaded file or pasted text
        job_description = ""
        active_tab = request.form.get("active_tab", "upload")

        if active_tab == "upload" and "document" in request.files:
            file = request.files["document"]
            if file.filename:
                # Use our safe temporary file handler instead
                with SafeTemporaryFile(
                    suffix=os.path.splitext(file.filename)[1]
                ) as temp_file:
                    file.save(temp_file.name)

                    # Process the file
                    try:
                        job_description = extract_text_from_file(temp_file.name)
                    except Exception as e:
                        flash(f"Error processing file: {str(e)}", "error")
                        return redirect(url_for("admin_create_campaign_from_doc"))
        else:
            # Use pasted text
            job_description = request.form.get("job_description", "")

        if not job_description:
            flash(
                "Please provide a job description either by uploading a document or pasting text.",
                "error",
            )
            return redirect(url_for("admin_create_campaign_from_doc"))

        # Generate campaign context and questions using AI
        campaign_context = generate_campaign_context(job_description)
        questions = generate_interview_questions(job_description, campaign_context)

        if not campaign_context or not questions:
            flash(
                "Failed to generate campaign content. Please try again or create a campaign manually.",
                "error",
            )
            return redirect(url_for("admin_create_campaign_from_doc"))

        # Create campaign
        total_points = sum(q["max_points"] for q in questions)
        conn = get_db_connection()
        cursor = conn.cursor()
        campaign_id = uuid.uuid4().int >> 64
        cursor.execute(
            """
            INSERT INTO campaigns (id, title, max_user_submissions, max_points, is_public, campaign_context)
            VALUES (%s, %s, %s, %s, %s, %s)
        """,
            (
                campaign_id,
                title,
                max_user_submissions,
                total_points,
                is_public,
                campaign_context,
            ),
        )
        conn.commit()
        conn.close()

        for question in questions:
            title = question["question"]
            body = question["question"]
            scoring_prompt = question["scoring_prompt"]
            max_points = question["max_points"]

            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points)
                VALUES (UUID_SHORT(), %s, %s, %s, %s, %s)
            """,
                (campaign_id, title, body, scoring_prompt, max_points),
            )

            conn.commit()
            conn.close()

        # Pass the generated content to the result template for review
        return redirect(url_for("admin_edit_campaign", campaign_id=campaign_id))

    return render_template("admin/campaigns/create_campaign_from_doc.html")


# Add a route to test sessions
@app.route("/api/test-session", methods=["GET", "POST"])
def test_session():
    if request.method == "POST":
        session["test_value"] = "This is a test value"
        return jsonify({"message": "Session value set", "session": dict(session)})
    else:
        return jsonify(
            {
                "has_session": bool(session),
                "session_contents": dict(session),
                "test_value": session.get("test_value", "Not set"),
            }
        )


# Handle OPTIONS requests globally
@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def handle_options(path):
    response = app.response_class(response=[], status=200)
    return response


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
