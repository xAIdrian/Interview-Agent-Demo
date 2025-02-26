from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from functools import wraps
import boto3
from database import get_db_connection, build_filter_query

# Create a Blueprint for the API routes
api_bp = Blueprint('api', __name__)

# Configure your S3 bucket name (already created)
S3_BUCKET = "gulpin-interviews"

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
        "id": user[0],
        "email": user[1],
        "name": user[2],
        "password_hash": user[3],
        "is_admin": user[4]
    } for user in users])

@api_bp.route('/campaigns', methods=['GET'])
@admin_required
def get_campaigns():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM campaigns")
    campaigns = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": campaign[0],
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
            "id": campaign[0],
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
        "id": question[0],
        "campaign_id": question[1],
        "title": question[2],
        "body": question[3],
        "scoring_prompt": question[4]
    } for question in questions])

@api_bp.route('/submissions', methods=['GET'])
@admin_required
def get_submissions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM submissions")
    submissions = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": submission[0],
        "campaign_id": submission[1],
        "user_id": submission[2],
        "creation_time": submission[3],
        "completion_time": submission[4],
        "is_complete": submission[5],
        "total_points": submission[6]
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
        "id": answer[0],
        "submission_id": answer[1],
        "question_id": answer[2],
        "video_path": answer[3],
        "transcript": answer[4]
    } for answer in submission_answers])

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