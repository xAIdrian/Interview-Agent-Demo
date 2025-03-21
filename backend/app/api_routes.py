from database import get_db_connection, build_filter_query
from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from functools import wraps
import boto3
import uuid
from config import Config
from scoring_agent import optimize_with_ai
import tempfile
import os
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash  # Add generate_password_hash
from document_processor import generate_campaign_context, generate_interview_questions, extract_text_from_document, generate_campaign_description
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity

# Create a Blueprint for the API routes
api_bp = Blueprint('api', __name__)

# Configure your S3 bucket name (already created)
S3_BUCKET = Config.S3_BUCKET_NAME

# Initialize S3 client
s3_client = boto3.client("s3")

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if auth_header != 'Bearer dVCjV5QO8t' and not session.get('is_admin'):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

def build_filter_query(args):
    filter_clauses = []
    filter_values = []
    for key, value in args.items():
        filter_clauses.append(f"{key} = %s")
        filter_values.append(value)
    filter_query = " AND ".join(filter_clauses)
    if filter_query:
        filter_query = "WHERE " + filter_query
    return filter_query, filter_values

# Helper function to verify JWT token
def jwt_token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Valid token is required"}), 401
        
        # Extract the token
        token = auth_header.split('Bearer ')[1]
        
        # This will be handled by flask_jwt_extended
        @jwt_required()
        def verify_jwt_token(*args, **kwargs):
            # If we get here, the token is valid
            return f(*args, **kwargs)
            
        return verify_jwt_token(*args, **kwargs)
    return decorated_function

# GET routes
@api_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    filter_query, filter_values = build_filter_query(request.args)
    cursor.execute(f"SELECT * FROM users {filter_query}", filter_values)
    
    users = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": str(user[0]),
        "email": user[1],
        "name": user[2],
        "password_hash": user[3],
        "is_admin": user[4]
    } for user in users])

@api_bp.route('/users/<int:id>', methods=['GET'])
@admin_required
def get_user(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = %s", (id,))
    user = cursor.fetchone()
    conn.close()
    if user:
        return jsonify({
            "id": str(user[0]),
            "email": user[1],
            "name": user[2],
            "password_hash": user[3],
            "is_admin": user[4]
        })
    else:
        return jsonify({"error": "User not found"}), 404

# Update GET /campaigns to include job_description
@api_bp.route('/campaigns', methods=['GET'])
@admin_required
def get_campaigns():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    filter_query, filter_values = build_filter_query(request.args)
    cursor.execute(f"SELECT * FROM campaigns {filter_query}", filter_values)
    
    campaigns = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": str(campaign[0]),
        "title": campaign[1],
        "max_user_submissions": campaign[2],
        "max_points": campaign[3],
        "is_public": campaign[4],
        "campaign_context": campaign[5],
        "job_description": campaign[6]
    } for campaign in campaigns])

# Update GET /campaigns/<id> to include job_description
@api_bp.route('/campaigns/<int:id>', methods=['GET'])
def get_campaign(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    if session.get('is_admin'):
        cursor.execute("SELECT * FROM campaigns WHERE id = %s", (id,))
    else:
        cursor.execute("SELECT * FROM campaigns WHERE id = %s AND is_public = TRUE", (id,))
    campaign = cursor.fetchone()
    conn.close()
    if campaign:
        return jsonify({
            "id": str(campaign[0]),
            "title": campaign[1],
            "max_user_submissions": campaign[2],
            "max_points": campaign[3],
            "is_public": campaign[4],
            "campaign_context": campaign[5],
            "job_description": campaign[6]
        })
    else:
        return jsonify({"error": "Campaign not found or not accessible"}), 404

@api_bp.route('/questions', methods=['GET'])
@admin_required
def get_questions():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    filter_query, filter_values = build_filter_query(request.args)
    cursor.execute(f"SELECT * FROM questions {filter_query}", filter_values)
    
    questions = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": str(question[0]),
        "campaign_id": str(question[1]),
        "title": question[2],
        "body": question[3],
        "scoring_prompt": question[4],
        "max_points": question[5]
    } for question in questions])

@api_bp.route('/submissions', methods=['GET'])
@admin_required
def get_submissions():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    filter_query, filter_values = build_filter_query(request.args)
    cursor.execute(f"""
        SELECT submissions.id, submissions.campaign_id, submissions.user_id, submissions.created_at, 
               submissions.completed_at, submissions.is_complete, submissions.total_points, 
               users.email, campaigns.title AS campaign_name
        FROM submissions
        JOIN users ON submissions.user_id = users.id
        JOIN campaigns ON submissions.campaign_id = campaigns.id
        {filter_query}
    """, filter_values)
    
    submissions = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": str(submission[0]),
        "campaign_id": str(submission[1]),
        "user_id": str(submission[2]),
        "created_at": submission[3],
        "completed_at": submission[4],
        "is_complete": submission[5],
        "total_points": submission[6],
        "email": submission[7],
        "campaign_name": submission[8]
    } for submission in submissions])

@api_bp.route('/submission_answers', methods=['GET'])
@admin_required
def get_submission_answers():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Replace the previous code to avoid ambiguous column references
    if request.args.get('submission_id'):
        # Case when specifically querying by submission_id
        submission_id = request.args.get('submission_id')
        query = """
            SELECT sa.id, sa.submission_id, sa.question_id, sa.video_path, 
                   sa.transcript, sa.score, sa.score_rationale
            FROM submission_answers sa
            WHERE sa.submission_id = %s
        """
        cursor.execute(query, (submission_id,))
    else:
        # Handle other filters using build_filter_query
        filter_query, filter_values = build_filter_query(request.args)
        
        # Make sure the table alias is used for all columns in the filter
        if filter_query:
            # Replace 'WHERE ' with 'WHERE sa.' and add 'sa.' before each 'AND'
            filter_query = filter_query.replace('WHERE ', 'WHERE sa.').replace(' AND ', ' AND sa.')
        
        query = f"""
            SELECT sa.id, sa.submission_id, sa.question_id, sa.video_path, 
                   sa.transcript, sa.score, sa.score_rationale
            FROM submission_answers sa
            {filter_query}
        """
        cursor.execute(query, filter_values)
    
    submission_answers = cursor.fetchall()
    conn.close()
    
    return jsonify([{
        "id": str(answer[0]),
        "submission_id": str(answer[1]),
        "question_id": str(answer[2]),
        "video_path": answer[3],
        "transcript": answer[4],
        "score": answer[5],
        "score_rationale": answer[6]
    } for answer in submission_answers])

@api_bp.route('/public_campaigns', methods=['GET'])
def get_public_campaigns():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM campaigns WHERE is_public = TRUE")
    campaigns = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": str(campaign[0]),
        "title": campaign[1],
        "max_user_submissions": campaign[2],
        "max_points": campaign[3],
        "is_public": campaign[4]
    } for campaign in campaigns])

@api_bp.route('/submissions/<int:id>', methods=['GET'])
@admin_required
def get_submission_by_id(id):
    """
    Get a specific submission by ID with joined data from users and campaigns tables
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT submissions.id, submissions.campaign_id, submissions.user_id, submissions.created_at, 
               submissions.completed_at, submissions.is_complete, submissions.total_points, 
               users.email, campaigns.title AS campaign_name
        FROM submissions
        JOIN users ON submissions.user_id = users.id
        JOIN campaigns ON submissions.campaign_id = campaigns.id
        WHERE submissions.id = %s
    """, (id,))
    
    submission = cursor.fetchone()
    conn.close()
    
    if not submission:
        return jsonify({"error": "Submission not found"}), 404
        
    return jsonify({
        "id": str(submission[0]),
        "campaign_id": str(submission[1]),
        "user_id": str(submission[2]),
        "created_at": submission[3],
        "completed_at": submission[4],
        "is_complete": submission[5],
        "total_points": submission[6],
        "email": submission[7],
        "campaign_name": submission[8]
    })

# POST routes
@api_bp.route('/users', methods=['POST'])
@admin_required
def create_user():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (id, email, name, password_hash, is_admin)
        VALUES (UUID_SHORT(), %s, %s, %s, %s)
    """, (data['email'], data['name'], data['password_hash'], data['is_admin']))
    conn.commit()
    conn.close()
    return jsonify({"message": "User created successfully"}), 201

@api_bp.route('/users/create', methods=['POST'])
@admin_required
def create_new_user():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Generate a temporary password or use a default one
    temporary_password = "changeme123"
    password_hash = temporary_password  # In production, use proper hashing
    
    try:
        cursor.execute("""
            INSERT INTO users (id, email, name, password_hash, is_admin)
            VALUES (UUID_SHORT(), %s, %s, %s, %s)
        """, (data['email'], data['name'], password_hash, data['is_admin']))
        conn.commit()
        
        return jsonify({
            "message": "User created successfully",
            "temporaryPassword": temporary_password
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Failed to create user: {str(e)}"}), 500
    finally:
        conn.close()

# Update POST /campaigns to include job_description
@api_bp.route('/campaigns', methods=['POST'])
@admin_required
def create_campaign():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    total_max_points = sum(question['max_points'] for question in data['questions'])
    campaign_id = uuid.uuid4().int >> 64
    
    cursor.execute("""
        INSERT INTO campaigns (id, title, max_user_submissions, max_points, is_public, campaign_context, job_description)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (campaign_id, data['title'], data['max_user_submissions'], total_max_points, data['is_public'], 
          data['campaign_context'], data['job_description']))

    for question in data['questions']:
        cursor.execute("""
            INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points)
            VALUES (UUID_SHORT(), %s, %s, %s, %s, %s)
        """, (campaign_id, question['title'], question['body'], question['scoring_prompt'], question['max_points']))

    conn.commit()
    conn.close()
    return jsonify({"message": "Campaign and questions created successfully"}), 201

@api_bp.route('/questions', methods=['POST'])
@admin_required
def create_question():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points)
        VALUES (UUID_SHORT(), %s, %s, %s, %s, %s)
    """, (data['campaign_id'], data['title'], data['body'], data['scoring_prompt'], data['max_points']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Question created successfully"}), 201

@api_bp.route('/submissions', methods=['POST'])
def create_submission():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO submissions (id, campaign_id, user_id, created_at, completed_at, is_complete, total_points)
        VALUES (UUID_SHORT(), %s, %s, %s, %s, %s, %s)
    """, (data['campaign_id'], data['user_id'], data['created_at'], data['completed_at'], data['is_complete'], data['total_points']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Submission created successfully"}), 201

@api_bp.route('/submission_answers', methods=['POST'])
def create_submission_answer():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO submission_answers (id, submission_id, question_id, video_path, transcript)
        VALUES (UUID_SHORT(), %s, %s, %s, %s)
    """, (data['submission_id'], data['question_id'], data['video_path'], data['transcript']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Submission answer created successfully"}), 201

@api_bp.route('/campaigns/create-from-doc', methods=['POST'])
@admin_required
def create_campaign_from_doc():
    """
    Extract campaign information from an uploaded document
    """
    if 'document' not in request.files:
        return jsonify({"error": "No document file provided"}), 400
        
    file = request.files['document']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    # Check if the file type is allowed
    allowed_extensions = {'pdf', 'doc', 'docx', 'txt'}
    if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
        return jsonify({"error": "File type not allowed"}), 400
    
    # Get template type from request data
    template_type = request.form.get('template_type', 'standard')
    
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
            
            return jsonify({ "context": context, "description": description, "questions": questions })
            
    except Exception as e:
        print(f"Error processing document: {e}")
        return jsonify({"error": f"Failed to process document: {str(e)}"}), 500

# Add route for getting document campaign templates
@api_bp.route('/campaigns/doc-templates', methods=['GET'])
@admin_required
def get_doc_templates():
    """
    Get available templates for document-based campaign creation
    """
    templates = get_campaign_templates()
    return jsonify(templates)

# Add route for getting default questions
@api_bp.route('/campaigns/default-questions', methods=['GET'])
@admin_required
def get_default_questions():
    """
    Get default questions when document processing fails
    """
    return jsonify(DEFAULT_QUESTIONS)

def update_table(table, id, data):
    conn = get_db_connection()
    cursor = conn.cursor()
    set_clause = ", ".join([f"{key} = %s" for key in data.keys()])
    values = list(data.values()) + [id]
    sql = f"UPDATE {table} SET {set_clause} WHERE id = %s"
    cursor.execute(sql, values)
    conn.commit()
    conn.close()

# PUT routes
@api_bp.route('/users/<int:id>', methods=['PUT'])
@admin_required
def update_user(id):
    data = request.json
    update_table("users", id, data)
    return jsonify({"message": "User updated successfully"}), 200

@api_bp.route('/campaigns/<int:id>', methods=['PUT'])
@admin_required
def update_campaign(id):
    data = request.json
    update_table("campaigns", id, data)
    return jsonify({"message": "Campaign updated successfully"}), 200

# Update PUT /campaigns/<id>/update to include job_description
@api_bp.route('/campaigns/<int:id>/update', methods=['POST'])
@admin_required
def update_campaign_with_questions(id):
    """
    Update a campaign and its questions (add, update, delete questions as needed)
    """
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Update campaign properties
    cursor.execute("""
        UPDATE campaigns
        SET title = %s, max_user_submissions = %s, is_public = %s, campaign_context = %s, job_description = %s
        WHERE id = %s
    """, (data['title'], data['max_user_submissions'], data['is_public'], data['campaign_context'], 
          data['job_description'], id))
    
    # Get existing questions for this campaign
    cursor.execute("SELECT id FROM questions WHERE campaign_id = %s", (id,))
    existing_question_ids = [row[0] for row in cursor.fetchall()]
    
    # Track which question IDs are still present in the updated data
    updated_question_ids = []
    
    # Process each question from the form data
    total_max_points = 0
    for question in data['questions']:
        if question['id']:  # Existing question - update it
            question_id = int(question['id'])
            updated_question_ids.append(question_id)
            cursor.execute("""
                UPDATE questions
                SET title = %s, body = %s, scoring_prompt = %s, max_points = %s
                WHERE id = %s AND campaign_id = %s
            """, (question['title'], question['body'], question['scoring_prompt'], 
                  question['max_points'], question_id, id))
            total_max_points += question['max_points']
        else:  # New question - insert it
            cursor.execute("""
                INSERT INTO questions (id, campaign_id, title, body, scoring_prompt, max_points)
                VALUES (UUID_SHORT(), %s, %s, %s, %s, %s)
            """, (id, question['title'], question['body'], question['scoring_prompt'], question['max_points']))
            total_max_points += question['max_points']
    
    # Find questions that were deleted (in existing_question_ids but not in updated_question_ids)
    for question_id in existing_question_ids:
        if question_id not in updated_question_ids:
            # Delete all submission answers for this question
            cursor.execute("DELETE FROM submission_answers WHERE question_id = %s", (question_id,))
            # Delete the question
            cursor.execute("DELETE FROM questions WHERE id = %s", (question_id,))
    
    # Update the campaign's max_points
    cursor.execute("UPDATE campaigns SET max_points = %s WHERE id = %s", (total_max_points, id))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "Campaign and questions updated successfully"}), 200

@api_bp.route('/questions/<int:id>', methods=['PUT'])
@admin_required
def update_question(id):
    data = request.json
    update_table("questions", id, data)
    return jsonify({"message": "Question updated successfully"}), 200

@api_bp.route('/submissions/<int:id>', methods=['PUT'])
@admin_required
def update_submission(id):
    data = request.json
    update_table("submissions", id, data)
    return jsonify({"message": "Submission updated successfully"}), 200

@api_bp.route('/submission_answers/<int:id>', methods=['PUT'])
@admin_required
def update_submission_answer(id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()

    # Update the submission answer
    cursor.execute("""
        UPDATE submission_answers
        SET transcript = %s, score = %s, score_rationale = %s
        WHERE id = %s
    """, (data.get('transcript'), data.get('score'), data.get('score_rationale'), id))

    # Get the submission_id for the updated answer
    cursor.execute("SELECT submission_id FROM submission_answers WHERE id = %s", (id,))
    submission_id = cursor.fetchone()[0]

    # Recalculate the total score for the submission
    cursor.execute("""
        SELECT SUM(score)
        FROM submission_answers
        WHERE submission_id = %s
    """, (submission_id,))
    total_score = cursor.fetchone()[0] or 0  # Use 0 if the sum is None

    # Update the submission with the new total score
    cursor.execute("""
        UPDATE submissions
        SET total_points = %s
        WHERE id = %s
    """, (total_score, submission_id))

    conn.commit()
    conn.close()
    return jsonify({"message": "Submission answer updated successfully"}), 200

# DELETE routes
@api_bp.route('/users/<int:id>', methods=['DELETE'])
@admin_required
def delete_user(id):
    """
    Delete a user and all related submissions and submission answers.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # First get all submissions by this user
    cursor.execute("SELECT id FROM submissions WHERE user_id = %s", (id,))
    submissions = cursor.fetchall()
    
    # Delete all submission answers for each submission
    for submission in submissions:
        submission_id = submission[0]
        cursor.execute("DELETE FROM submission_answers WHERE submission_id = %s", (submission_id,))
    
    # Delete all submissions by this user
    cursor.execute("DELETE FROM submissions WHERE user_id = %s", (id,))
    
    # Finally, delete the user
    cursor.execute("DELETE FROM users WHERE id = %s", (id,))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "User and all related data deleted successfully"}), 200

@api_bp.route('/campaigns/<int:id>', methods=['DELETE'])
@admin_required
def delete_campaign(id):
    """
    Delete a campaign and all associated questions, submissions, and submission answers.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # First get all submissions for this campaign
    cursor.execute("SELECT id FROM submissions WHERE campaign_id = %s", (id,))
    submissions = cursor.fetchall()
    
    # Delete all submission answers for each submission
    for submission in submissions:
        submission_id = submission[0]
        cursor.execute("DELETE FROM submission_answers WHERE submission_id = %s", (submission_id,))
    
    # Delete all submissions for this campaign
    cursor.execute("DELETE FROM submissions WHERE campaign_id = %s", (id,))
    
    # Delete all questions for this campaign
    cursor.execute("DELETE FROM questions WHERE campaign_id = %s", (id,))
    
    # Finally, delete the campaign
    cursor.execute("DELETE FROM campaigns WHERE id = %s", (id,))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "Campaign and all related data deleted successfully"}), 200

@api_bp.route('/questions/<int:id>', methods=['DELETE'])
@admin_required
def delete_question(id):
    """
    Delete a question, all associated submission answers, and update the max_points of its campaign.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # First get the question's campaign_id and max_points
    cursor.execute("SELECT campaign_id, max_points FROM questions WHERE id = %s", (id,))
    result = cursor.fetchone()
    
    if not result:
        conn.close()
        return jsonify({"error": "Question not found"}), 404
        
    campaign_id, question_max_points = result
    
    # Delete all submission answers for this question
    cursor.execute("DELETE FROM submission_answers WHERE question_id = %s", (id,))
    
    # Delete the question
    cursor.execute("DELETE FROM questions WHERE id = %s", (id,))
    
    # Update the campaign's max_points
    cursor.execute("UPDATE campaigns SET max_points = max_points - %s WHERE id = %s", 
                  (question_max_points, campaign_id))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "Question deleted successfully and campaign max_points updated"}), 200

@api_bp.route('/submissions/<int:id>', methods=['DELETE'])
@admin_required
def delete_submission(id):
    """
    Delete a submission and all its associated submission answers.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Delete all submission answers for this submission
    cursor.execute("DELETE FROM submission_answers WHERE submission_id = %s", (id,))
    
    # Delete the submission
    cursor.execute("DELETE FROM submissions WHERE id = %s", (id,))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "Submission and its answers deleted successfully"}), 200

@api_bp.route('/submission_answers/<int:id>', methods=['DELETE'])
@admin_required
def delete_submission_answer(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM submission_answers WHERE id = %s", (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Submission answer deleted successfully"}), 200


@api_bp.route("/optimize_prompt", methods=["POST"])
@admin_required
def optimize_prompt_api():
    data = request.json
    campaign_name = data.get("campaign_name", "")
    campaign_context = data.get("campaign_context", "")
    question = data.get("question", "")
    original_prompt = data.get("prompt", "")
    
    if not original_prompt:
        return jsonify({"error": "No prompt provided"}), 400
    
    try:
        optimized_prompt = optimize_with_ai(campaign_name, campaign_context, question, original_prompt)
        return jsonify({"optimized_prompt": optimized_prompt})
    except Exception as e:
        print(f"Error optimizing prompt: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_current_user_profile():
    try:
        """
        Get the profile information for the currently logged-in user using JWT
        If user_id is provided and the requester is an admin, return that user's profile
        Otherwise return the current user's profile
        """
        # Get user identity from JWT
        current_user = get_jwt_identity()
        current_user_id = current_user.get("id")
        is_admin = current_user.get("is_admin", False)
        
        # Get requested user_id from query parameters
        requested_user_id = request.args.get("user_id")
        
        # Determine which user's profile to fetch
        target_user_id = requested_user_id if requested_user_id and is_admin else current_user_id
        
        # If a user is requesting someone else's profile and isn't an admin, reject
        if requested_user_id and requested_user_id != current_user_id and not is_admin:
            return jsonify({"error": "You are not authorized to view this profile"}), 403
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = %s", (target_user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return jsonify({
                "id": str(user["id"]),
                "email": user["email"],
                "name": user["name"],
                "is_admin": user["is_admin"]
            })
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

# Add a session debug endpoint
@api_bp.route('/debug/session', methods=['GET'])
def debug_session():
    """
    Debug endpoint to check the current session
    """
    return jsonify({
        "session": dict(session),
        "has_session": bool(session),
        "keys": list(session.keys()) if session else []
    })

# Add a route to handle the proper login (if not already present)
@api_bp.route('/login', methods=['POST'])
def login():
    """
    Handle user login and establish JWT-based authentication
    """
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    print(f"Login attempt: {email}")
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)  # Use dictionary cursor for named columns
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        print(f"User not found: {email}")
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Use check_password_hash for secure password verification
    if not check_password_hash(user["password_hash"], password):
        print(f"Invalid password for: {email}")
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Create JWT tokens for the user
    user_identity = {
        "id": str(user["id"]),
        "email": user["email"],
        "is_admin": user["is_admin"]
    }
    
    access_token = create_access_token(identity=user_identity)
    refresh_token = create_refresh_token(identity=user_identity)
    
    print(f"Login successful for: {email}")
    
    # Return user data and tokens
    return jsonify({
        "id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "is_admin": bool(user["is_admin"]),
        "access_token": access_token,
        "refresh_token": refresh_token
    })

@api_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_current_user_profile():
    """
    Update the profile information for a user
    If user_id is provided and the requester is an admin, update that user's profile
    Otherwise update the current user's profile
    """
    # Get user identity from JWT
    current_user = get_jwt_identity()
    current_user_id = current_user.get("id")
    is_admin = current_user.get("is_admin", False)
    
    # Get data from request
    data = request.json
    
    # Determine which user's profile to update
    target_user_id = data.get("user_id") if is_admin and data.get("user_id") else current_user_id
    
    # If a user is trying to update someone else's profile and isn't an admin, reject
    if data.get("user_id") and data.get("user_id") != current_user_id and not is_admin:
        return jsonify({"error": "You are not authorized to update this profile"}), 403
    
    # Filter which fields can be updated
    updateable_fields = {
        "name": data.get("name"),
        "email": data.get("email")
    }
    
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
        set_clause = ", ".join([f"{key} = %s" for key in filtered_data.keys()])
        values = list(filtered_data.values()) + [target_user_id]
        
        cursor.execute(f"UPDATE users SET {set_clause} WHERE id = %s", values)
        
        if cursor.rowcount == 0:
            conn.rollback()
            conn.close()
            return jsonify({"error": "User not found"}), 404
            
        conn.commit()
        
        # Fetch the updated user data
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = %s", (target_user_id,))
        updated_user = cursor.fetchone()
        conn.close()
        
        return jsonify({
            "message": "Profile updated successfully",
            "user": {
                "id": str(updated_user["id"]),
                "email": updated_user["email"],
                "name": updated_user["name"],
                "is_admin": updated_user["is_admin"]
            }
        }), 200
        
    except Exception as e:
        print(f"Error updating profile: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_current_user_password():
    """
    Change the password for a user
    If user_id is provided and the requester is an admin, change that user's password
    Otherwise change the current user's password
    """
    # Get user identity from JWT
    current_user = get_jwt_identity()
    current_user_id = current_user.get("id")
    is_admin = current_user.get("is_admin", False)
    
    data = request.json
    
    # Determine which user's password to change
    target_user_id = data.get("user_id") if is_admin and data.get("user_id") else current_user_id
    
    # If a user is trying to change someone else's password and isn't an admin, reject
    if data.get("user_id") and data.get("user_id") != current_user_id and not is_admin:
        return jsonify({"error": "You are not authorized to change this user's password"}), 403
    
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
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
            cursor.execute("SELECT password_hash FROM users WHERE id = %s", (current_user_id,))
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
        new_password_hash = generate_password_hash(new_password, method='pbkdf2:sha256')
        
        # Update the password with the new hash
        cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_password_hash, target_user_id))
        
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

@api_bp.route('/logout', methods=['POST'])
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
@api_bp.route('/register', methods=['POST'])
def register():
    """
    Handle user registration
    """
    data = request.json
    email = data.get('email')
    name = data.get('name')
    password = data.get('password')
    
    if not email or not name or not password:
        return jsonify({"error": "Email, name, and password are required"}), 400
    
    # Check if user already exists
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    existing_user = cursor.fetchone()
    
    if existing_user:
        conn.close()
        return jsonify({"error": "A user with this email address already exists"}), 409
    
    try:
        # Generate password hash
        password_hash = generate_password_hash(password, method='pbkdf2:sha256')
        
        # Insert new user, default to non-admin
        cursor.execute("""
            INSERT INTO users (id, email, name, password_hash, is_admin)
            VALUES (UUID_SHORT(), %s, %s, %s, %s)
        """, (email, name, password_hash, False))
        conn.commit()
        
        # Get the new user's ID
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user_id = cursor.fetchone()["id"]
        
        # Create JWT tokens for the new user
        user_identity = {
            "id": str(user_id),
            "email": email,
            "is_admin": False
        }
        
        access_token = create_access_token(identity=user_identity)
        refresh_token = create_refresh_token(identity=user_identity)
        
        conn.close()
        
        return jsonify({
            "message": "User registered successfully",
            "id": str(user_id),
            "name": name,
            "email": email,
            "is_admin": False,
            "access_token": access_token,
            "refresh_token": refresh_token
        }), 201
        
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error registering user: {e}")
        return jsonify({"error": f"Failed to register user: {str(e)}"}), 500

@api_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def get_current_auth_user():
    """
    Get current authenticated user for navbar and access control
    """
    try:
        # Get user identity from JWT
        current_user = get_jwt_identity()
        
        if not current_user or not current_user.get("id"):
            return jsonify({"error": "Invalid token or missing user identity"}), 401
            
        user_id = current_user.get("id")
        
        # Get user data from database to ensure it's current
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, email, name, is_admin FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        return jsonify({
            "id": str(user["id"]),
            "email": user["email"],
            "name": user["name"],
            "is_admin": bool(user["is_admin"]),
            "isAuthenticated": True
        })
        
    except Exception as e:
        print(f"Error in auth/me endpoint: {e}")
        return jsonify({
            "error": str(e),
            "isAuthenticated": False
        }), 500