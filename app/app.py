from botocore.exceptions import ClientError
from config import Config
from database import get_db_connection, create_tables
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import boto3
import os
import random
import string
import tempfile
import uuid
import whisper
import mariadb

from api_routes import api_bp

app = Flask(__name__)
app.config.from_object(Config)
app.register_blueprint(api_bp, url_prefix='/api')

@app.before_first_request
def create_tables_on_startup():
    create_tables()

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        email = request.form.get("email")
        name = request.form.get("name") or ""
        password = request.form.get("password")
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "INSERT INTO users (id, email, name, password_hash, is_admin) VALUES (UUID_SHORT(), ?, ?, ?, ?)"
            cursor.execute(sql, (email, name, hashed_password, False))
        conn.commit()
        conn.close()

        flash("Registration successful! Please log in.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]
        
        conn = get_db_connection()
        with conn.cursor(dictionary=True) as cursor:
            sql = "SELECT id, email, password_hash, is_admin FROM users WHERE email = ?"
            cursor.execute(sql, (email,))
            user = cursor.fetchone()
        
        conn.close()
        
        if user and check_password_hash(user["password_hash"], password):
            session["user_id"] = user["id"]
            session["email"] = user["email"]
            session["is_admin"] = user["is_admin"]
            flash("Login successful!", "success")
            return redirect(url_for("index"))
        else:
            flash("Invalid email or password", "danger")
    
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.pop("user_id", None)
    session.pop("is_admin", None)
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))

# Decorator to require login
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

# Decorator to require admin
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("is_admin"):
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
    with conn.cursor() as cursor:
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
        password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "INSERT INTO users (id, email, password, is_admin) VALUES (UUID_SHORT(), ?, ?, ?)"
            cursor.execute(sql, (email, hashed_password, is_admin))
        conn.commit()
        conn.close()

        flash(f"User created successfully! The password is: {password}", "success")
        return redirect(url_for("admin_users"))

    return render_template("admin/users/create_user.html")

@app.route("/admin/campaigns")
@admin_required
def admin_campaigns():
    conn = get_db_connection()
    with conn.cursor(dictionary=True) as cursor:
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
        with conn.cursor() as cursor:
            # Insert the new campaign
            cursor.execute("INSERT INTO campaigns (id, title, max_user_submissions, max_points, is_public) VALUES (UUID_SHORT(), ?, ?, ?, ?)", (title, max_user_submissions, 0, is_public))
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
                    VALUES (UUID_SHORT(), ?, ?, ?, ?, ?)
                """
                cursor.execute(sql_question, (campaign_id, question_title, question_body, scoring_prompt, max_points))

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
    with conn.cursor(dictionary=True) as cursor:
        # Get campaign details
        cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
        campaign = cursor.fetchone()
        
        # Get questions count
        cursor.execute("SELECT COUNT(*) AS count FROM questions WHERE campaign_id = ?", (campaign_id,))
        questions_count = cursor.fetchone()["count"]
        
        # Get submissions count
        cursor.execute("SELECT COUNT(*) AS count FROM submissions WHERE campaign_id = ?", (campaign_id,))
        submissions_count = cursor.fetchone()["count"]
    
    conn.close()
    
    return render_template("admin/campaigns/campaign.html",
                           campaign=campaign,
                           questions_count=questions_count,
                           submissions_count=submissions_count)

@app.route("/admin/campaigns/<int:campaign_id>/submissions/<int:submission_id>")
@admin_required
def admin_submission_details(campaign_id, submission_id):
    conn = get_db_connection()
    with conn.cursor(dictionary=True) as cursor:
        # Get submission details
        cursor.execute("""
        SELECT submissions.*, users.email, campaigns.title AS campaign_name
        FROM submissions
        JOIN users ON submissions.user_id = users.id
        JOIN campaigns ON submissions.campaign_id = campaigns.id
        WHERE submissions.id = ?
        """, (submission_id,))
        submission = cursor.fetchone()
        
        # Get submission answers
        cursor.execute("""
        SELECT submission_answers.*, questions.title AS question_title
        FROM submission_answers
        JOIN questions ON submission_answers.question_id = questions.id
        WHERE submission_answers.submission_id = ?
        """, (submission_id,))
        submission_answers = cursor.fetchall()
    
    conn.close()
    
    return render_template("admin/campaigns/submission.html",
                           campaign_id=campaign_id,
                           submission=submission,
                           submission_answers=submission_answers)

# Mock: Example function to get campaign questions from DB
def get_campaign_questions(campaign_id):
    conn = get_db_connection()
    with conn.cursor(dictionary=True) as cursor:
        sql = """
        SELECT id, title, body, scoring_prompt
        FROM questions
        WHERE campaign_id = ?
        """
        cursor.execute(sql, (campaign_id,))
        questions = cursor.fetchall()
    conn.close()
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
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('login'))  # Redirect to login if not logged in
    
    # Generate or retrieve a LiveKit token for the candidate to join the room
    livekit_token = generate_livekit_token(campaign_id, user_id)
    
    # Create a new submission in the database and get the submission_id
    conn = get_db_connection()
    with conn.cursor() as cursor:
        # Check if campaign_id exists
        cursor.execute("SELECT id FROM campaigns WHERE id = ?", (campaign_id,))
        campaign = cursor.fetchone()
        if not campaign:
            return jsonify({"error": "Invalid campaign_id"}), 400

        submission_id = uuid.uuid4().int >> 64

        sql = """
        INSERT INTO submissions (id, campaign_id, user_id, creation_time, total_points)
        VALUES (?, ?, ?, NOW(), ?)
        """
        try:
            cursor.execute(sql, (submission_id, campaign_id, user_id, 0))  # Set total_points to 0 initially
            
        except mariadb.IntegrityError as e:
            return jsonify({"error": str(e)}), 400

    conn.commit()
    conn.close()
    
    return render_template("interview_room.html", questions=questions, livekit_token=livekit_token, submission_id=submission_id)

# Configure your S3 bucket name (already created)
S3_BUCKET = "gulpin-interviews"

# Initialize S3 client
s3_client = boto3.client("s3")

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
            with conn.cursor() as cursor:
                sql = """
                INSERT INTO submission_answers (id, submission_id, question_id, answer, video_path, transcript)
                VALUES (UUID_SHORT(), ?, ?, ?, ?, ?)
                """
                cursor.execute(sql, (submission_id, question_id, "", s3_filename, transcript_text))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Database insertion error: {e}")
            return jsonify({"error": "Database insertion failed"}), 500

        # 5. Clean up local temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

        # 6. Return a success response
        return jsonify({
            "message": "File uploaded and transcribed successfully!",
            "s3_key": s3_filename,
            "transcript": transcript_text
        }), 200

    except Exception as e:
        print(f"Error handling file: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/")
def index():
    if session.get("is_admin"):
        return redirect(url_for("admin_index"))
    else:
        return render_template("candidate_index.html")

if __name__ == "__main__":
    app.run()