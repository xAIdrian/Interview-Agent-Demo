from database import get_db_connection, build_filter_query
from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from functools import wraps
import boto3
import uuid
from config import Config

# Create a Blueprint for the API routes
api_bp = Blueprint('api', __name__)

# Configure your S3 bucket name (already created)
S3_BUCKET = Config.S3_BUCKET_NAME

# Initialize S3 client
s3_client = boto3.client("s3")

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

# GET routes
@api_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
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

@api_bp.route('/campaigns', methods=['GET'])
@admin_required
def get_campaigns():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM campaigns")
    campaigns = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": str(campaign[0]),
        "title": campaign[1],
        "max_user_submissions": campaign[2],
        "max_points": campaign[3],
        "is_public": campaign[4]
    } for campaign in campaigns])

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
            "is_public": campaign[4]
        })
    else:
        return jsonify({"error": "Campaign not found or not accessible"}), 404

@api_bp.route('/questions', methods=['GET'])
@admin_required
def get_questions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM questions")
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
    cursor.execute("""
        SELECT submissions.id, submissions.campaign_id, submissions.user_id, submissions.creation_time, 
               submissions.completion_time, submissions.is_complete, submissions.total_points, users.email
        FROM submissions
        JOIN users ON submissions.user_id = users.id
    """)
    submissions = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": str(submission[0]),
        "campaign_id": str(submission[1]),
        "user_id": str(submission[2]),
        "creation_time": submission[3],
        "completion_time": submission[4],
        "is_complete": submission[5],
        "total_points": submission[6],
        "email": submission[7]
    } for submission in submissions])

@api_bp.route('/submission_answers', methods=['GET'])
@admin_required
def get_submission_answers():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM submission_answers")
    submission_answers = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": str(answer[0]),
        "submission_id": str(answer[1]),
        "question_id": str(answer[2]),
        "video_path": answer[3],
        "transcript": answer[4]
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

@api_bp.route('/campaigns', methods=['POST'])
@admin_required
def create_campaign():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    total_max_points = sum(question['max_points'] for question in data['questions'])
    campaign_id = uuid.uuid4().int >> 64
    
    cursor.execute("""
        INSERT INTO campaigns (id, title, max_user_submissions, max_points, is_public)
        VALUES (%s, %s, %s, %s, %s)
    """, (campaign_id, data['title'], data['max_user_submissions'], total_max_points, data['is_public']))

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
        INSERT INTO submissions (id, campaign_id, user_id, creation_time, completion_time, is_complete, total_points)
        VALUES (UUID_SHORT(), %s, %s, %s, %s, %s, %s)
    """, (data['campaign_id'], data['user_id'], data['creation_time'], data['completion_time'], data['is_complete'], data['total_points']))
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

@api_bp.route('/finalize_submission/<int:submission_id>', methods=['POST'])
def finalize_submission(submission_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT questions.title, submission_answers.transcript
        FROM submission_answers
        JOIN questions ON submission_answers.question_id = questions.id
        WHERE submission_answers.submission_id = %s
    """, (submission_id,))
    answers = cursor.fetchall()
    conn.close()

    for question, transcript in answers:
        print(f"Question: {question}")
        print(f"Transcript: {transcript}")
        print("-----")

    return jsonify({"message": "Submission finalized and transcripts printed"}), 200

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
    update_table("submission_answers", id, data)
    return jsonify({"message": "Submission answer updated successfully"}), 200

# DELETE routes
@api_bp.route('/users/<int:id>', methods=['DELETE'])
@admin_required
def delete_user(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = %s", (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted successfully"}), 200

@api_bp.route('/campaigns/<int:id>', methods=['DELETE'])
@admin_required
def delete_campaign(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM questions WHERE campaign_id = %s", (id,))
    cursor.execute("DELETE FROM campaigns WHERE id = %s", (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Campaign and its questions deleted successfully"}), 200

@api_bp.route('/questions/<int:id>', methods=['DELETE'])
@admin_required
def delete_question(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM questions WHERE id = %s", (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Question deleted successfully"}), 200

@api_bp.route('/submissions/<int:id>', methods=['DELETE'])
@admin_required
def delete_submission(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM submission_answers WHERE submission_id = %s", (id,))
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