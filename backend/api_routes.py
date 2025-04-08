from database import (
    get_db_connection,
    build_filter_query,
    ensure_string_id,
    map_row_to_dict,
)
from flask import (
    Blueprint,
    request,
    jsonify,
    session,
    redirect,
    url_for,
    render_template,
    current_app as app,
)
from flask_cors import CORS, cross_origin
from functools import wraps
import boto3
import uuid
from config import Config
from scoring_agent import optimize_with_ai
import tempfile
import os
from werkzeug.utils import secure_filename
from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)  # Add generate_password_hash
from document_processor import (
    generate_campaign_context,
    generate_interview_questions,
    extract_text_from_document,
    generate_campaign_description,
)
import json
import re
import bcrypt
from livekit.token_server import LiveKitTokenServer

# Create a Blueprint for the API routes
api_bp = Blueprint("api", __name__)

# Configure your S3 bucket name (already created)
S3_BUCKET = Config.S3_BUCKET_NAME

# Initialize S3 client with credentials
s3_client = boto3.client(
    "s3",
    aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY=***REMOVED***=***REMOVED***,
    aws_session_token=Config.AWS_SESSION_TOKEN,
    region_name=Config.S3_REGION,
)


# Decorator to check admin status via session
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is an admin via session
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)

    return decorated_function


def build_filter_query(args):
    filter_clauses = []
    filter_values = []
    for key, value in args.items():
        filter_clauses.append(f"{key} = ?")
        filter_values.append(value)
    filter_query = " AND ".join(filter_clauses)
    if filter_query:
        filter_query = "WHERE " + filter_query
    return filter_query, filter_values


# GET routes
@api_bp.route("/users", methods=["GET"])
# @admin_required
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()

    filter_query, filter_values = build_filter_query(request.args)
    cursor.execute(f"SELECT * FROM users {filter_query}", filter_values)

    users = cursor.fetchall()
    columns = ["id", "email", "name", "password_hash", "is_admin"]

    # Use the helper function to map rows to dictionaries with string IDs
    result = [map_row_to_dict(user, columns) for user in users]

    conn.close()
    return jsonify(result)


@api_bp.route("/users/<string:id>", methods=["GET"])
# @admin_required
def get_user(id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Ensure ID is a string
    user_id = str(id)

    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()

    if user:
        columns = ["id", "email", "name", "password_hash", "is_admin"]
        result = map_row_to_dict(user, columns)
        return jsonify(result)
    else:
        return jsonify({"error": "User not found"}), 404


# Update GET /campaigns to include job_description and use helper function
@api_bp.route(
    "/campaigns", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
)
def handle_campaigns():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    if request.method == "GET":
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM campaigns")
        campaigns = cursor.fetchall()
        columns = [
            "id",
            "title",
            "max_user_submissions",
            "max_points",
            "is_public",
            "campaign_context",
            "job_description",
            "created_by",
            "created_at",
            "updated_at",
        ]
        result = [map_row_to_dict(campaign, columns) for campaign in campaigns]
        conn.close()
        return jsonify(result)

    if request.method == "POST":
        data = request.get_json()
        campaign_id = str(uuid.uuid4())

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Insert campaign
            cursor.execute(
                "INSERT INTO campaigns (id, title, campaign_context, job_description, max_user_submissions, is_public) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    campaign_id,
                    data["title"],
                    data["campaign_context"],
                    data["job_description"],
                    data["max_user_submissions"],
                    data["is_public"],
                ),
            )

            # Insert questions
            for question in data["questions"]:
                question_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        question_id,
                        campaign_id,
                        question["title"],
                        question["body"],
                        question["scoring_prompt"],
                        question["max_points"],
                    ),
                )

            conn.commit()
            return (
                jsonify({"success": True, "message": "Campaign created successfully"}),
                201,
            )

        except Exception as e:
            conn.rollback()
            return jsonify({"success": False, "message": str(e)}), 400

        finally:
            conn.close()


# Update GET /campaigns/<id> to use the helper function
@api_bp.route("/campaigns/<string:id>", methods=["GET"])
def get_campaign(id):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Ensure ID is a string
        campaign_id = str(id)
        print(f"Looking for campaign with ID: {campaign_id}")  # Debug log

        # Try to find the campaign with the given ID
        cursor.execute(
            "SELECT * FROM campaigns WHERE id = ? OR CAST(id AS TEXT) = ?",
            (campaign_id, campaign_id),
        )

        campaign = cursor.fetchone()
        print(f"Found campaign: {campaign}")  # Debug log

        if campaign:
            columns = [
                "id",
                "title",
                "max_user_submissions",
                "max_points",
                "is_public",
                "campaign_context",
                "job_description",
            ]
            result = map_row_to_dict(campaign, columns)
            return jsonify(result)
        else:
            print("Campaign not found")  # Debug log
            return jsonify({"error": "Campaign not found"}), 404

    except Exception as e:
        print(f"Error retrieving campaign: {str(e)}")  # Debug log
        return jsonify({"error": f"Error retrieving campaign: {str(e)}"}), 500
    finally:
        conn.close()


@api_bp.route("/questions", methods=["GET"])
# @admin_required
def get_questions():
    conn = get_db_connection()
    cursor = conn.cursor()

    filter_query, filter_values = build_filter_query(request.args)
    cursor.execute(f"SELECT * FROM questions {filter_query}", filter_values)

    questions = cursor.fetchall()
    columns = ["id", "campaign_id", "title", "body", "scoring_prompt", "max_points"]

    # Use the helper function to map rows to dictionaries with string IDs
    result = [map_row_to_dict(question, columns) for question in questions]

    conn.close()
    return jsonify(result)


@api_bp.route("/questions/<string:id>", methods=["GET"])
# @admin_required
def get_question(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Ensure ID is a string
    question_id = str(id)

    cursor.execute("SELECT * FROM questions WHERE id = ?", (question_id,))
    question = cursor.fetchone()
    conn.close()

    if question:
        columns = ["id", "campaign_id", "title", "body", "scoring_prompt", "max_points"]
        # Use the helper function to create the response with string IDs
        result = map_row_to_dict(question, columns)
        return jsonify(result)
    else:
        return jsonify({"error": "Question not found"}), 404


@api_bp.route("/submissions", methods=["GET"])
def get_submissions():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Build query with filters
    args = request.args.to_dict()
    base_query = "SELECT * FROM submissions"

    # Apply filters if any
    if args:
        filter_query, filter_values = build_filter_query(args)
        cursor.execute(f"{base_query} {filter_query}", filter_values)
    else:
        cursor.execute(base_query)

    submissions = cursor.fetchall()
    columns = [
        "id",
        "campaign_id",
        "user_id",
        "created_at",
        "total_points",
        "is_complete",
    ]

    # Map rows to dictionaries with string IDs
    result = [map_row_to_dict(submission, columns) for submission in submissions]

    conn.close()
    return jsonify(result)


@api_bp.route("/submission_answers", methods=["GET"])
# @admin_required
def get_submission_answers():
    # Get user identity from session
    user_id = session.get("user_id")
    is_admin = session.get("is_admin", False)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Build query with filters
    args = request.args.to_dict()

    # If not admin, validate ownership of submissions before fetching answers
    if not is_admin and "submission_id" in args:
        # Check if the submission belongs to the current user
        submission_id = args["submission_id"]
        cursor.execute("SELECT user_id FROM submissions WHERE id = ?", (submission_id,))
        submission = cursor.fetchone()

        if not submission or submission[0] != user_id:
            conn.close()
            return jsonify({"error": "Access denied"}), 403

    # Build and execute query
    base_query = "SELECT * FROM submission_answers"
    if args:
        filter_query, filter_values = build_filter_query(args)
        cursor.execute(f"{base_query} {filter_query}", filter_values)
    else:
        cursor.execute(base_query)

    submission_answers = cursor.fetchall()
    columns = [
        "id",
        "submission_id",
        "question_id",
        "video_path",
        "transcript",
        "score",
        "score_rationale",
    ]

    # Map rows to dictionaries with string IDs
    result = [map_row_to_dict(answer, columns) for answer in submission_answers]

    conn.close()
    return jsonify(result)


@api_bp.route("/public_campaigns", methods=["GET"])
def get_public_campaigns():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM campaigns WHERE is_public = TRUE")
    campaigns = cursor.fetchall()
    columns = [
        "id",
        "title",
        "max_user_submissions",
        "max_points",
        "is_public",
        "campaign_context",
        "job_description",
    ]

    # Use the helper function to map rows to dictionaries with string IDs
    result = [map_row_to_dict(campaign, columns) for campaign in campaigns]

    conn.close()
    return jsonify(result)


@api_bp.route("/submissions/<string:id>", methods=["GET"])
# @admin_required
def get_submission_by_id(id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get user identity from session
    user_id = session.get("user_id")
    is_admin = session.get("is_admin", False)

    # Verify that the ID is a string
    submission_id = ensure_string_id(id)

    # Check if user has access to this submission
    # if not is_admin:
    # cursor.execute("SELECT user_id FROM submissions WHERE id = ?", (submission_id,))
    # submission = cursor.fetchone()
    # if not submission or submission[0] != user_id:
    # conn.close()
    # return jsonify({"error": "Access denied for user"}), 403

    # Get submission details
    cursor.execute(
        """
        SELECT s.*, u.email, c.title AS campaign_title
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        JOIN campaigns c ON s.campaign_id = c.id
        WHERE s.id = ?
    """,
        (submission_id,),
    )

    submission = cursor.fetchone()
    if not submission:
        conn.close()
        return jsonify({"error": "Submission not found"}), 404

    # Get submission answers
    cursor.execute(
        """
        SELECT sa.*, q.title AS question_title
        FROM submission_answers sa
        JOIN questions q ON sa.question_id = q.id
        WHERE sa.submission_id = ?
    """,
        (submission_id,),
    )

    answers = cursor.fetchall()

    conn.close()

    # Format response
    columns_submission = [
        "id",
        "campaign_id",
        "user_id",
        "created_at",
        "total_points",
        "is_complete",
        "email",
        "campaign_title",
    ]
    columns_answers = [
        "id",
        "submission_id",
        "question_id",
        "video_path",
        "transcript",
        "score",
        "score_rationale",
        "question_title",
    ]

    result = {
        "submission": map_row_to_dict(submission, columns_submission),
        "answers": [map_row_to_dict(answer, columns_answers) for answer in answers],
    }

    return jsonify(result)


# Add a public endpoint to get submission by ID for the interview page
@api_bp.route("/submissions/<string:id>", methods=["GET"])
def get_submission_for_interview(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, campaign_id, user_id, created_at, updated_at, 
               is_complete, total_points, resume_path, resume_text
        FROM submissions 
        WHERE id = ?
    """,
        (id,),
    )
    submission = cursor.fetchone()
    conn.close()

    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    # Convert to dict with column names
    column_names = [desc[0] for desc in cursor.description]
    submission_dict = {column_names[i]: submission[i] for i in range(len(column_names))}

    return jsonify(submission_dict)


# POST routes
@api_bp.route("/users", methods=["POST"])
# @admin_required
def create_user():
    data = request.json

    # Validate required fields
    if not data or "email" not in data or "name" not in data:
        return jsonify({"error": "Required fields missing: email, name"}), 400

    # Validate email format
    email = data.get("email", "")
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email format"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if user with this email already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "A user with this email already exists"}), 400

        # Generate a UUID for the user
        user_id = str(uuid.uuid4())

        # Generate a default password if not provided
        password_hash = data.get("password_hash")
        if not password_hash:
            # In a real application, you would use a proper password hashing algorithm
            temporary_password = "changeme123"
            password_hash = temporary_password

        # Insert the new user
        cursor.execute(
            """
            INSERT INTO users (id, email, name, password_hash, is_admin)
            VALUES (?, ?, ?, ?, ?) RETURNING *
        """,
            (
                user_id,
                email,
                data.get("name", ""),
                password_hash,
                data.get("is_admin", False),
            ),
        )

        # Get the newly created user
        new_user = cursor.fetchone()
        conn.commit()

        # Prepare response with string IDs and exclude sensitive information
        columns = ["id", "email", "name", "is_admin"]
        result = map_row_to_dict(new_user, columns)

        # If we generated a temporary password, include it in the response
        if data.get("password_hash") is None:
            result["temporary_password"] = temporary_password

        conn.close()
        return jsonify(result), 201

    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"error": f"Failed to create user: {str(e)}"}), 500


@api_bp.route("/users/create", methods=["POST"])
# @admin_required
def create_new_user():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    # Generate a temporary password or use a default one
    temporary_password = "changeme123"
    password_hash = temporary_password  # In production, use proper hashing

    try:
        cursor.execute(
            """
            INSERT INTO users (id, email, name, password_hash, is_admin)
            VALUES (UUID_SHORT(), ?, ?, ?, ?)
        """,
            (data["email"], data["name"], password_hash, data["is_admin"]),
        )
        conn.commit()

        return (
            jsonify(
                {
                    "message": "User created successfully",
                    "temporaryPassword": temporary_password,
                }
            ),
            201,
        )
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Failed to create user: {str(e)}"}), 500
    finally:
        conn.close()


# Update POST /campaigns to include job_description
@api_bp.route("/campaigns", methods=["POST"])
# @admin_required
def create_campaign():
    data = request.json

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Calculate the total max points from all questions
        total_max_points = sum(
            question.get("max_points", 0) for question in data.get("questions", [])
        )

        # Insert the campaign using MariaDB's UUID_SHORT() function
        cursor.execute(
            """
            INSERT INTO campaigns (id, title, max_user_submissions, max_points, is_public, campaign_context, job_description)
            VALUES (UUID_SHORT(), ?, ?, ?, ?, ?, ?) RETURNING *
        """,
            (
                data.get("title"),
                data.get("max_user_submissions", 1),
                total_max_points,
                data.get("is_public", False),
                data.get("campaign_context", ""),
                data.get("job_description", ""),
            ),
        )

        # Get the newly created campaign
        new_campaign = cursor.fetchone()

        # Create questions if provided
        questions_created = []
        for question in data.get("questions", []):
            cursor.execute(
                """
                INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points)
                VALUES (UUID_SHORT(), ?, ?, ?, ?, ?) RETURNING *
            """,
                (
                    new_campaign[0],
                    question.get("title", ""),
                    question.get("body", ""),
                    question.get("scoring_prompt", ""),
                    question.get("max_points", 0),
                ),
            )
            new_question = cursor.fetchone()
            questions_created.append(
                map_row_to_dict(
                    new_question,
                    [
                        "id",
                        "campaign_id",
                        "title",
                        "body",
                        "scoring_prompt",
                        "max_points",
                    ],
                )
            )

        conn.commit()

        # Prepare the response
        campaign_columns = [
            "id",
            "title",
            "max_user_submissions",
            "max_points",
            "is_public",
            "campaign_context",
            "job_description",
        ]
        result = map_row_to_dict(new_campaign, campaign_columns)
        result["questions"] = questions_created

        conn.close()
        return jsonify(result), 201

    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"error": f"Failed to create campaign: {str(e)}"}), 500


@api_bp.route("/questions", methods=["POST"])
# @admin_required
def create_question():
    data = request.json

    # Validate required fields
    if not data or "campaign_id" not in data or "title" not in data:
        return jsonify({"error": "Required fields missing: campaign_id, title"}), 400

    # Ensure ID is a string
    campaign_id = str(data.get("campaign_id"))

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify that the campaign exists
        cursor.execute("SELECT id FROM campaigns WHERE id = ?", (campaign_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Campaign not found"}), 404

        # Generate a unique ID for the question
        question_id = str(uuid.uuid4())

        # Insert the question
        cursor.execute(
            """
            INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING *
        """,
            (
                question_id,
                campaign_id,
                data.get("title", ""),
                data.get("body", ""),
                data.get("scoring_prompt", ""),
                data.get("max_points", 0),
            ),
        )

        # Get the newly created question
        new_question = cursor.fetchone()
        conn.commit()

        # Prepare response with string IDs
        columns = ["id", "campaign_id", "title", "body", "scoring_prompt", "max_points"]
        result = map_row_to_dict(new_question, columns)

        conn.close()
        return jsonify(result), 201

    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"error": f"Failed to create question: {str(e)}"}), 500


@api_bp.route("/submissions", methods=["POST"])
def create_submission():
    # Validate request data
    data = request.get_json()
    if not data or "campaign_id" not in data:
        return jsonify({"error": "campaign_id is required"}), 400

    # Get user ID from session
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401

    # Ensure campaign_id is a string
    campaign_id = str(data["campaign_id"])

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if campaign exists
        cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
        campaign = cursor.fetchone()
        if not campaign:
            conn.close()
            return jsonify({"error": "Campaign not found"}), 404

        # Generate UUID using Python's uuid module
        submission_id = str(uuid.uuid4())

        # Create submission with UUID and authenticated user ID
        cursor.execute(
            "INSERT INTO submissions (id, campaign_id, user_id) VALUES (?, ?, ?) RETURNING *",
            (submission_id, campaign_id, user_id),
        )
        submission = cursor.fetchone()
        conn.commit()

        # Map to dictionary with string IDs
        columns = [
            "id",
            "campaign_id",
            "user_id",
            "created_at",
            "is_complete",
            "completed_at",
            "total_points",
            "resume_path",
            "resume_text",
        ]
        result = map_row_to_dict(submission, columns)

        conn.close()
        return jsonify(result), 201
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"error": str(e)}), 500


@api_bp.route("/submission_answers", methods=["POST"])
# @admin_required
def create_submission_answer():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Generate UUID in Python
        submission_answer_id = str(uuid.uuid4())

        cursor.execute(
            """
            INSERT INTO submission_answers (id, submission_id, question_id, video_path, transcript)
            VALUES (?, ?, ?, ?, ?)
        """,
            (
                submission_answer_id,
                data["submission_id"],
                data["question_id"],
                data["video_path"],
                data["transcript"],
            ),
        )
        conn.commit()
        return (
            jsonify(
                {
                    "message": "Submission answer created successfully",
                    "id": submission_answer_id,
                }
            ),
            201,
        )
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@api_bp.route("/campaigns/create-from-doc", methods=["POST"])
# @admin_required
def create_campaign_from_doc():
    """
    Extract campaign information from an uploaded document
    """
    if "document" not in request.files:
        return jsonify({"error": "No document file provided"}), 400

    file = request.files["document"]

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    # Check if the file type is allowed
    allowed_extensions = {"pdf", "doc", "docx", "txt"}
    if not (
        "." in file.filename
        and file.filename.rsplit(".", 1)[1].lower() in allowed_extensions
    ):
        return jsonify({"error": "File type not allowed"}), 400

    # Get template type from request data
    template_type = request.form.get("template_type", "standard")

    try:
        # Save the file temporarily
        filename = secure_filename(file.filename)
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, filename)
            file.save(file_path)

            # Process the document to extract campaign information

            upload_text = extract_text_from_document(file_path)
            context = generate_campaign_context(upload_text)
            description = generate_campaign_description(upload_text)
            questions = generate_interview_questions(upload_text, context)

            print("Upload text: ", upload_text)
            print("Context: ", context)
            print("Description: ", description)
            print("Questions: ", questions)

            return jsonify(
                {"context": context, "description": description, "questions": questions}
            )

    except Exception as e:
        print(f"Error processing document: {e}")
        return jsonify({"error": f"Failed to process document: {str(e)}"}), 500


# Add route for getting document campaign templates
@api_bp.route("/campaigns/doc-templates", methods=["GET"])
# @admin_required
def get_doc_templates():
    """
    Get available templates for document-based campaign creation
    """
    templates = get_campaign_templates()
    return jsonify(templates)


# Add route for getting default questions
@api_bp.route("/campaigns/default-questions", methods=["GET"])
# @admin_required
def get_default_questions():
    """
    Get default questions when document processing fails
    """
    return jsonify(DEFAULT_QUESTIONS)


def update_table(table, id, data):
    conn = get_db_connection()
    cursor = conn.cursor()
    set_clause = ", ".join([f"{key} = ?" for key in data.keys()])
    values = list(data.values()) + [id]
    sql = f"UPDATE {table} SET {set_clause} WHERE id = ?"
    cursor.execute(sql, values)
    conn.commit()
    conn.close()


# PUT routes
@api_bp.route("/users/<string:id>", methods=["PUT"])
def update_user(id):
    data = request.json

    # Ensure ID is a string
    user_id = str(id)

    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Extract user data
    email = data.get("email")
    name = data.get("name")
    password = data.get("password")
    is_admin = data.get("is_admin")

    # Validate email
    if email and not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email format"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # First check if user exists
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        existing_user = cursor.fetchone()
        if not existing_user:
            conn.close()
            return jsonify({"error": "User not found"}), 404

        # Start building the update query
        update_parts = []
        params = []

        if email:
            update_parts.append("email = ?")
            params.append(email)

        if name:
            update_parts.append("name = ?")
            params.append(name)

        if password:
            hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
            update_parts.append("password_hash = ?")
            params.append(hashed_password.decode("utf-8"))

        if is_admin is not None:
            update_parts.append("is_admin = ?")
            params.append(is_admin)

        if not update_parts:
            conn.close()
            return jsonify({"error": "No fields to update"}), 400

        # Finalize and execute the update query
        query = f"UPDATE users SET {', '.join(update_parts)} WHERE id = ?"
        params.append(user_id)

        cursor.execute(query, params)
        conn.commit()

        # Fetch the updated user
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        updated_user = cursor.fetchone()
        conn.close()

        if updated_user:
            columns = ["id", "email", "name", "password_hash", "is_admin"]
            result = map_row_to_dict(updated_user, columns)
            return jsonify(result)
        else:
            return jsonify({"error": "User not found after update"}), 404

    except Exception as e:
        if conn:
            conn.close()
        return jsonify({"error": f"Failed to update user: {str(e)}"}), 500


@api_bp.route("/campaigns/<string:id>", methods=["PUT"])
# @admin_required
def update_campaign(id):
    data = request.json
    update_table("campaigns", id, data)
    return jsonify({"message": "Campaign updated successfully"}), 200


# Update PUT /campaigns/<id>/update to include job_description
@api_bp.route("/campaigns/<string:id>/update", methods=["POST"])
# @admin_required
def update_campaign_with_questions(id):
    """
    Update a campaign and its questions (add, update, delete questions as needed)
    """
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    # Update campaign properties
    cursor.execute(
        """
        UPDATE campaigns
        SET title = ?, max_user_submissions = ?, is_public = ?, campaign_context = ?, job_description = ?
        WHERE id = ?
    """,
        (
            data["title"],
            data["max_user_submissions"],
            data["is_public"],
            data["campaign_context"],
            data["job_description"],
            id,
        ),
    )

    # Get existing questions for this campaign
    cursor.execute("SELECT id FROM questions WHERE campaign_id = ?", (id,))
    existing_question_ids = [row[0] for row in cursor.fetchall()]

    # Track which question IDs are still present in the updated data
    updated_question_ids = []

    # Process each question from the form data
    total_max_points = 0
    for question in data["questions"]:
        if question["id"]:  # Existing question - update it
            question_id = int(question["id"])
            updated_question_ids.append(question_id)
            cursor.execute(
                """
                UPDATE questions
                SET title = ?, body = ?, scoring_prompt = ?, max_points = ?
                WHERE id = ? AND campaign_id = ?
            """,
                (
                    question["title"],
                    question["body"],
                    question["scoring_prompt"],
                    question["max_points"],
                    question_id,
                    id,
                ),
            )
            total_max_points += question["max_points"]
        else:  # New question - insert it
            cursor.execute(
                """
                INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points)
                VALUES (UUID_SHORT(), ?, ?, ?, ?, ?)
            """,
                (
                    id,
                    question["title"],
                    question["body"],
                    question["scoring_prompt"],
                    question["max_points"],
                ),
            )
            total_max_points += question["max_points"]

    # Find questions that were deleted (in existing_question_ids but not in updated_question_ids)
    for question_id in existing_question_ids:
        if question_id not in updated_question_ids:
            # Delete all submission answers for this question
            cursor.execute(
                "DELETE FROM submission_answers WHERE question_id = ?", (question_id,)
            )
            # Delete the question
            cursor.execute("DELETE FROM questions WHERE id = ?", (question_id,))

    # Update the campaign's max_points
    cursor.execute(
        "UPDATE campaigns SET max_points = ? WHERE id = ?", (total_max_points, id)
    )

    conn.commit()
    conn.close()
    return jsonify({"message": "Campaign and questions updated successfully"}), 200


@api_bp.route("/questions/<string:id>", methods=["PUT"])
# @admin_required
def update_question(id):
    data = request.json
    update_table("questions", id, data)
    return jsonify({"message": "Question updated successfully"}), 200


@api_bp.route("/submissions/<string:id>", methods=["PUT"])
# @admin_required
def update_submission(id):
    data = request.json
    update_table("submissions", id, data)
    return jsonify({"message": "Submission updated successfully"}), 200


@api_bp.route("/submission_answers/<string:id>", methods=["PUT"])
# @admin_required
def update_submission_answer(id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # First check if the submission answer exists
        cursor.execute("SELECT id FROM submission_answers WHERE id = ?", (id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Submission answer not found"}), 404

        # Convert transcript to JSON string if it's a list
        transcript = data.get("transcript")
        if isinstance(transcript, list):
            transcript = json.dumps(transcript)

        # Validate and convert score to integer or None
        score = data.get("score")
        if score is not None:
            try:
                score = int(score)
            except (ValueError, TypeError):
                return jsonify({"error": "Score must be an integer"}), 400

        # Update the submission answer
        cursor.execute(
            """
            UPDATE submission_answers
            SET transcript = ?, score = ?, score_rationale = ?
            WHERE id = ?
        """,
            (transcript, score, data.get("score_rationale"), id),
        )

        # Get the submission_id for the updated answer
        cursor.execute(
            "SELECT submission_id FROM submission_answers WHERE id = ?", (id,)
        )
        result = cursor.fetchone()
        if not result:
            conn.rollback()
            return jsonify({"error": "Submission answer not found"}), 404

        submission_id = result[0]

        # Recalculate the total score for the submission
        cursor.execute(
            """
            SELECT SUM(score)
            FROM submission_answers
            WHERE submission_id = ? AND score IS NOT NULL
        """,
            (submission_id,),
        )
        total_score = cursor.fetchone()[0] or 0  # Use 0 if the sum is None

        # Update the submission with the new total score
        cursor.execute(
            """
            UPDATE submissions
            SET total_points = ?
            WHERE id = ?
        """,
            (total_score, submission_id),
        )

        conn.commit()
        return jsonify({"message": "Submission answer updated successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# DELETE routes
@api_bp.route("/users/<string:id>", methods=["DELETE"])
# @admin_required
def delete_user(id):
    """
    Delete a user and all related submissions and submission answers.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM users WHERE id = ?", (id,))
        conn.commit()
        return jsonify({"success": True, "message": "User deleted successfully"})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        conn.close()


@api_bp.route("/campaigns/<string:id>", methods=["DELETE"])
# @admin_required
def delete_campaign(id):
    """
    Delete a campaign and all associated questions, submissions, and submission answers.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM campaigns WHERE id = ?", (id,))
        conn.commit()
        return jsonify({"success": True, "message": "Campaign deleted successfully"})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        conn.close()


@api_bp.route("/questions/<string:id>", methods=["DELETE"])
# @admin_required
def delete_question(id):
    """
    Delete a question, all associated submission answers, and update the max_points of its campaign.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Get campaign_id and max_points before deleting
        cursor.execute(
            "SELECT campaign_id, max_points FROM questions WHERE id = ?", (id,)
        )
        result = cursor.fetchone()
        if result:
            campaign_id, max_points = result
            cursor.execute("DELETE FROM questions WHERE id = ?", (id,))
            cursor.execute(
                "UPDATE campaigns SET max_points = max_points - ? WHERE id = ?",
                (max_points, campaign_id),
            )
        conn.commit()
        return jsonify({"success": True, "message": "Question deleted successfully"})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        conn.close()


@api_bp.route("/submissions/<string:id>", methods=["DELETE"])
# @admin_required
def delete_submission(id):
    """
    Delete a submission and all its associated submission answers.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Delete all submission answers for this submission
    cursor.execute("DELETE FROM submission_answers WHERE submission_id = ?", (id,))

    # Delete the submission
    cursor.execute("DELETE FROM submissions WHERE id = ?", (id,))

    conn.commit()
    conn.close()
    return jsonify({"message": "Submission and its answers deleted successfully"}), 200


@api_bp.route("/submission_answers/<string:id>", methods=["DELETE"])
# @admin_required
def delete_submission_answer(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM submission_answers WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Submission answer deleted successfully"}), 200


@api_bp.route("/optimize_prompt", methods=["POST", "OPTIONS"])
def optimize_prompt():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    try:
        data = request.get_json()
        # Your existing optimization logic here
        return jsonify({"optimized_prompt": "Optimized prompt here"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400


@api_bp.route("/profile", methods=["GET"])
def get_current_user_profile():
    # Get the current user's identity from session
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401

    try:
        # Get user data from database
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, email, name, is_admin, created_at
            FROM users
            WHERE id = ?
        """,
            (user_id,),
        )

        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Convert ID to string for frontend consistency
        user["id"] = str(user["id"])

        # Get user's submissions count
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT COUNT(*) AS submission_count
            FROM submissions
            WHERE user_id = ?
        """,
            (user_id,),
        )

        submission_count = cursor.fetchone()[0]
        user["submission_count"] = submission_count

        # Get user's completed submissions
        cursor.execute(
            """
            SELECT COUNT(*) AS completed_count
            FROM submissions
            WHERE user_id = ? AND is_complete = TRUE
        """,
            (user_id,),
        )

        completed_count = cursor.fetchone()[0]
        user["completed_submissions"] = completed_count

        conn.close()

        return jsonify(user)

    except Exception as e:
        print(f"Error retrieving user profile: {e}")
        return jsonify({"error": "Failed to retrieve user profile"}), 500


# Add a session debug endpoint
@api_bp.route("/debug/session", methods=["GET"])
def debug_session():
    """
    Debug endpoint to check the current session
    """
    return jsonify(
        {
            "session": dict(session),
            "has_session": bool(session),
            "keys": list(session.keys()) if session else [],
        }
    )


# Add a route to handle the proper login (if not already present)
@api_bp.route("/login", methods=["POST"])
def login():
    """
    Handle user login and establish session-based authentication
    """
    data = request.json
    email = data.get("email")
    password = data.get("password")

    print(f"Login attempt: {email}")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)  # Use dictionary cursor for named columns
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        print(f"User not found: {email}")
        return jsonify({"error": "Invalid credentials"}), 401

    # Use check_password_hash for secure password verification
    if not check_password_hash(user["password_hash"], password):
        print(f"Invalid password for: {email}")
        return jsonify({"error": "Invalid credentials"}), 401

    # Make session permanent
    session.permanent = True

    # Store user info in session
    session["user_id"] = str(user["id"])
    session["email"] = user["email"]
    session["name"] = user["name"]
    session["is_admin"] = bool(user["is_admin"])  # Ensure boolean value

    print(f"Login successful for: {email}")
    print(f"Session after login: {session}")
    print(f"Admin status: {session.get('is_admin')}")  # Debug log

    # Return user data
    return jsonify(
        {
            "id": str(user["id"]),
            "email": user["email"],
            "name": user["name"],
            "is_admin": bool(user["is_admin"]),
        }
    )


@api_bp.route("/profile", methods=["PUT"])
# @admin_required
def update_current_user_profile():
    """
    Update the profile information for a user
    If user_id is provided and the requester is an admin, update that user's profile
    Otherwise update the current user's profile
    """
    # Get user identity from session
    current_user = session.get("user_identity")
    current_user_id = current_user.get("id")
    is_admin = current_user.get("is_admin", False)

    # Get data from request
    data = request.json

    # Determine which user's profile to update
    target_user_id = (
        data.get("user_id") if is_admin and data.get("user_id") else current_user_id
    )

    # If a user is trying to update someone else's profile and isn't an admin, reject
    if data.get("user_id") and data.get("user_id") != current_user_id and not is_admin:
        return jsonify({"error": "You are not authorized to update this profile"}), 403

    # Filter which fields can be updated
    updateable_fields = {"name": data.get("name"), "email": data.get("email")}

    # If admin is updating, they can also update admin status
    if is_admin and "is_admin" in data and data.get("user_id"):
        updateable_fields["is_admin"] = data.get("is_admin")

    # Remove None values
    filtered_data = {k: v for k, v in updateable_fields.items() if v is not None}

    if not filtered_data:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Build the update query
        set_clause = ", ".join([f"{key} = ?" for key in filtered_data.keys()])
        values = list(filtered_data.values()) + [target_user_id]

        cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)

        if cursor.rowcount == 0:
            conn.rollback()
            conn.close()
            return jsonify({"error": "User not found"}), 404

        conn.commit()

        # Fetch the updated user data
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = ?", (target_user_id,))
        updated_user = cursor.fetchone()
        conn.close()

        return (
            jsonify(
                {
                    "message": "Profile updated successfully",
                    "user": {
                        "id": str(updated_user["id"]),
                        "email": updated_user["email"],
                        "name": updated_user["name"],
                        "is_admin": updated_user["is_admin"],
                    },
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error updating profile: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route("/change-password", methods=["POST"])
# @admin_required
def change_current_user_password():
    """
    Change the password for a user
    If user_id is provided and the requester is an admin, change that user's password
    Otherwise change the current user's password
    """
    # Get user identity from session
    current_user = session.get("user_identity")
    current_user_id = current_user.get("id")
    is_admin = current_user.get("is_admin", False)

    data = request.json

    # Determine which user's password to change
    target_user_id = (
        data.get("user_id") if is_admin and data.get("user_id") else current_user_id
    )

    # If a user is trying to change someone else's password and isn't an admin, reject
    if data.get("user_id") and data.get("user_id") != current_user_id and not is_admin:
        return (
            jsonify({"error": "You are not authorized to change this user's password"}),
            403,
        )

    current_password = data.get("current_password")
    new_password = data.get("new_password")

    # Admin reset doesn't require current password
    if not is_admin or not data.get("user_id"):
        if not current_password:
            return jsonify({"error": "Current password is required"}), 400

    if not new_password:
        return jsonify({"error": "New password is required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Verify current password (except for admin reset)
        if not is_admin or not data.get("user_id"):
            cursor.execute(
                "SELECT password_hash FROM users WHERE id = ?", (current_user_id,)
            )
            result = cursor.fetchone()

            if not result:
                conn.close()
                return jsonify({"error": "User not found"}), 404

            stored_password_hash = result["password_hash"]

            # Use proper password verification
            if not check_password_hash(stored_password_hash, current_password):
                conn.close()
                return jsonify({"error": "Current password is incorrect"}), 401

        # Generate hash for new password
        new_password_hash = generate_password_hash(new_password, method="pbkdf2:sha256")

        # Update the password with the new hash
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (new_password_hash, target_user_id),
        )

        if cursor.rowcount == 0:
            conn.rollback()
            conn.close()
            return jsonify({"error": "User not found"}), 404

        conn.commit()
        conn.close()

        return jsonify({"message": "Password changed successfully"}), 200

    except Exception as e:
        print(f"Error changing password: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route("/logout", methods=["POST"])
def logout():
    """
    Log out the current user by clearing their session
    """
    # Add debug logging
    print(f"Logging out user with session: {session}")

    # Clear the session
    session.clear()

    print(f"Session after logout: {session}")

    return jsonify({"message": "Logged out successfully"}), 200


# Add a route for user registration
@api_bp.route("/register", methods=["POST"])
def register():
    """
    Handle user registration
    """
    data = request.json
    email = data.get("email")
    name = data.get("name")
    password = data.get("password")

    if not email or not name or not password:
        return jsonify({"error": "Email, name, and password are required"}), 400

    # Check if user already exists
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    existing_user = cursor.fetchone()

    if existing_user:
        conn.close()
        return jsonify({"error": "A user with this email address already exists"}), 409

    try:
        # Generate password hash
        password_hash = generate_password_hash(password, method="pbkdf2:sha256")

        # Insert new user, default to non-admin
        cursor.execute(
            """
            INSERT INTO users (id, email, name, password_hash, is_admin)
            VALUES (UUID_SHORT(), ?, ?, ?, ?)
        """,
            (email, name, password_hash, False),
        )
        conn.commit()

        # Get the new user's ID
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        user_id = cursor.fetchone()["id"]

        # Make session permanent
        session.permanent = True

        # Set up user session
        session["user_id"] = str(user_id)
        session["email"] = email
        session["name"] = name
        session["is_admin"] = False

        conn.close()

        return (
            jsonify(
                {
                    "message": "User registered successfully",
                    "id": str(user_id),
                    "name": name,
                    "email": email,
                    "is_admin": False,
                }
            ),
            201,
        )

    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error registering user: {e}")
        return jsonify({"error": f"Failed to register user: {str(e)}"}), 500


# Add a health check endpoint
@api_bp.route("/health", methods=["GET", "HEAD"])
def health_check():
    """
    Simple health check endpoint to verify the API is running
    """
    return jsonify({"status": "ok", "message": "API is operational"}), 200


@api_bp.route("/upload_resume", methods=["POST"])
def upload_resume():
    """Upload a resume to S3, extract text, and update the submission"""
    if "resume" not in request.files:
        return jsonify({"error": "No resume file provided"}), 400

    resume_file = request.files["resume"]
    user_id = request.form.get("user_id")
    position_id = request.form.get("position_id")
    submission_id = request.form.get("submission_id")

    if not resume_file.filename or not submission_id:
        return jsonify({"error": "Missing required fields"}), 400

    # Ensure the filename is secure
    filename = secure_filename(resume_file.filename)

    # Generate a unique filename to prevent overwrites
    file_extension = os.path.splitext(filename)[1]
    unique_filename = f"{user_id}_{submission_id}_{uuid.uuid4()}{file_extension}"

    # Create a temporary file
    temp_file = None
    try:
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, unique_filename)

        # Save the uploaded file to our temporary path
        resume_file.save(temp_path)

        # Upload to S3
        s3_path = f"resumes/{unique_filename}"
        s3_client.upload_file(
            temp_path,
            S3_BUCKET,
            s3_path,
            ExtraArgs={"ContentType": resume_file.content_type},
        )

        # Extract text from the resume
        resume_text = extract_text_from_document(temp_path)

        # Update the submission with the resume path and text
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE submissions 
            SET resume_path = ?, resume_text = ? 
            WHERE id = ?
        """,
            (s3_path, resume_text, submission_id),
        )
        conn.commit()
        conn.close()

        return (
            jsonify(
                {"message": "Resume uploaded successfully", "resume_path": s3_path}
            ),
            200,
        )

    except Exception as e:
        # Log the error
        print(f"Error processing resume: {str(e)}")
        return jsonify({"error": f"Error processing resume: {str(e)}"}), 500
    finally:
        # Clean up the temporary file if it exists
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as cleanup_error:
                # Just log cleanup errors, don't fail the request
                print(f"Warning: Could not remove temporary file: {str(cleanup_error)}")


@api_bp.route("/submissions/<string:id>/complete", methods=["POST"])
# @admin_required
def complete_submission(id):
    try:
        # Get user identity from session
        current_user = session.get("user_identity")
        user_id = str(current_user.get("id"))
        is_admin = current_user.get("is_admin", False)

        conn = get_db_connection()
        cursor = conn.cursor()

        # Ensure ID is treated as string
        submission_id = str(id)

        # First check if the submission exists and belongs to the current user (unless admin)
        if is_admin:
            cursor.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,))
        else:
            cursor.execute(
                "SELECT * FROM submissions WHERE id = ? AND user_id = ?",
                (submission_id, user_id),
            )

        submission = cursor.fetchone()

        if not submission:
            conn.close()
            return (
                jsonify(
                    {
                        "error": "Submission not found or you don't have permission to modify it"
                    }
                ),
                404,
            )

        # Update submission as complete
        cursor.execute(
            "UPDATE submissions SET is_complete = TRUE WHERE id = ? RETURNING *",
            (submission_id,),
        )
        updated_submission = cursor.fetchone()

        # Store transcript if provided
        transcript_data = request.json.get("transcript", [])
        if transcript_data:
            # Convert to string if not already
            transcript_json = json.dumps(transcript_data)

            # Save transcript to the database
            cursor.execute(
                "UPDATE submissions SET transcript = ? WHERE id = ?",
                (transcript_json, submission_id),
            )

        conn.commit()
        conn.close()

        return (
            jsonify(
                {
                    "message": "Submission completed successfully",
                    "id": str(updated_submission[0]),
                    "is_complete": True,
                }
            ),
            200,
        )

    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"error": str(e)}), 500


@api_bp.route("/submit_interview", methods=["POST"])
def submit_interview():
    from scoring_agent import generate_submission_scoring

    try:
        data = request.json
        transcript = data.get("transcript")
        submission_id = data.get("submission_id")

        # Get submission details including campaign_id
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT campaign_id FROM submissions WHERE id = ?", (submission_id,)
        )
        submission = cursor.fetchone()

        if not submission:
            conn.close()
            return jsonify({"error": "Submission not found"}), 404

        campaign_id = submission[0]

        # Get campaign details
        cursor.execute(
            "SELECT title, campaign_context, description FROM campaigns WHERE id = ?",
            (campaign_id,),
        )
        campaign_row = cursor.fetchone()

        if not campaign_row:
            conn.close()
            return jsonify({"error": "Campaign not found"}), 404

        campaign = {
            "title": campaign_row[0],
            "campaign_context": campaign_row[1],
            "job_description": campaign_row[2],
        }

        # Get questions for this campaign
        cursor.execute(
            "SELECT id, body, scoring_prompt, max_points FROM questions WHERE campaign_id = ?",
            (campaign_id,),
        )
        questions = [
            {
                "id": row[0],
                "body": row[1],
                "scoring_prompt": row[2],
                "max_points": row[3],
            }
            for row in cursor.fetchall()
        ]

        conn.close()

        scores = generate_submission_scoring(campaign, questions, transcript)
        print(scores)

        # Get new connection since we closed the previous one
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Calculate total score
            total_score = sum(score["score"] for score in scores)

            # Update each answer in submission_answers
            for score in scores:
                cursor.execute(
                    """
                    INSERT INTO submission_answers 
                    (id, submission_id, question_id, transcript, score, score_rationale)
                    VALUES (uuid_short(), ?, ?, ?, ?, ?)
                """,
                    (
                        submission_id,
                        score["question_id"],
                        score["response"],
                        score["score"],
                        score["rationale"],
                    ),
                )

            # Mark submission as complete and update total score
            cursor.execute(
                """
                UPDATE submissions
                SET is_complete = 1,
                    total_points = ?
                WHERE id = ?
            """,
                (total_score, submission_id),
            )

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        print("Received transcript:", transcript)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Add LiveKit token endpoint
@api_bp.route("/livekit/token", methods=["GET", "OPTIONS"])
def get_livekit_token():
    """Generate and return a LiveKit token for joining a room"""
    if request.method == "OPTIONS":
        # Handle preflight request
        response = jsonify({"status": "ok"})
        # Let the global CORS middleware handle the headers
        return response, 200

    # Get parameters from the request
    campaign_id = request.args.get("campaignId", "")
    room = request.args.get("room")

    try:
        # Generate room name if not provided
        if not room:
            # Use synchronous call since this is not an async function
            import uuid

            room = f"interview-{str(uuid.uuid4())[:8]}"

        # Generate token
        token = LiveKitTokenServer.generate_token(campaign_id, room)

        # Create response without explicit CORS headers (let global middleware handle it)
        response = jsonify({"token": token, "room": room})
        return response, 200
    except Exception as e:
        app.logger.error(f"Error generating LiveKit token: {str(e)}")
        error_response = jsonify({"error": str(e)})
        return error_response, 500


@api_bp.route("/test-campaigns", methods=["POST", "OPTIONS"])
def test_create_campaign():
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response, 200

    try:
        data = request.get_json()
        print("Received data:", data)  # For debugging

        # Calculate total max points from questions
        total_max_points = sum(
            question.get("max_points", 0) for question in data.get("questions", [])
        )

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Generate a simpler UUID that SQLite can handle
            campaign_id = str(
                uuid.uuid4().hex[:8]
            )  # Use first 8 characters of hex UUID

            # Insert campaign
            cursor.execute(
                """
                INSERT INTO campaigns (
                    id, title, max_user_submissions, max_points, 
                    is_public, campaign_context, job_description
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    campaign_id,
                    data.get("title"),
                    data.get("max_user_submissions", 1),
                    total_max_points,
                    data.get("is_public", False),
                    data.get("campaign_context", ""),
                    data.get("job_description", ""),
                ),
            )

            # Insert questions
            questions_created = []
            for question in data.get("questions", []):
                # Generate a simpler UUID for questions
                question_id = str(
                    uuid.uuid4().hex[:8]
                )  # Use first 8 characters of hex UUID

                cursor.execute(
                    """
                    INSERT INTO questions (
                        id, campaign_id, title, body, 
                        scoring_prompt, max_points, order_index
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        question_id,
                        campaign_id,
                        question.get("title", ""),
                        question.get("body", question.get("title", "")),
                        question.get("scoring_prompt", ""),
                        question.get("max_points", 0),
                        0,  # default order_index
                    ),
                )
                questions_created.append(
                    {
                        "id": question_id,
                        "campaign_id": campaign_id,
                        "title": question.get("title", ""),
                        "body": question.get("body", question.get("title", "")),
                        "scoring_prompt": question.get("scoring_prompt", ""),
                        "max_points": question.get("max_points", 0),
                    }
                )

            # Commit the transaction
            conn.commit()

            # Verify the campaign was created by fetching it
            cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
            created_campaign = cursor.fetchone()

            if not created_campaign:
                raise Exception("Campaign was not saved to database")

            # Prepare response
            response = jsonify(
                {
                    "success": True,
                    "message": "Campaign created successfully",
                    "data": {
                        "id": campaign_id,
                        "title": data.get("title"),
                        "campaign_context": data.get("campaign_context", ""),
                        "job_description": data.get("job_description", ""),
                        "max_user_submissions": data.get("max_user_submissions", 1),
                        "max_points": total_max_points,
                        "is_public": data.get("is_public", False),
                        "questions": questions_created,
                    },
                }
            )
            response.headers.add("Access-Control-Allow-Origin", "*")
            return response, 201

        except Exception as e:
            conn.rollback()
            print("Database error:", str(e))  # For debugging
            raise e
        finally:
            conn.close()

    except Exception as e:
        print("Error creating campaign:", str(e))  # For debugging
        response = jsonify(
            {"success": False, "message": f"Failed to create campaign: {str(e)}"}
        )
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 400
