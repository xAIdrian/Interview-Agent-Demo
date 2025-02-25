from flask import Flask, render_template, request, redirect, url_for, flash, session
from config import Config
from database import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import random
import string

app = Flask(__name__)
app.config.from_object(Config)

def create_users_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                is_admin BOOLEAN NOT NULL DEFAULT FALSE
            )
        """)
    conn.commit()
    conn.close()

def create_campaigns_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS campaigns (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                max_user_submissions INT NOT NULL DEFAULT 1
            )
        """)
    conn.commit()
    conn.close()

def create_questions_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                campaign_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                scoring_prompt TEXT NOT NULL,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
            )
        """)
    conn.commit()
    conn.close()

def create_submissions_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS submissions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                campaign_id INT NOT NULL,
                user_id INT NOT NULL,
                submission_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
            )
        """)
    conn.commit()
    conn.close()

def create_submission_answers_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS submission_answers (
                id INT PRIMARY KEY AUTO_INCREMENT,
                submission_id INT NOT NULL,
                question_id INT NOT NULL,
                answer TEXT NOT NULL,
                FOREIGN KEY (submission_id) REFERENCES submissions(id),
                FOREIGN KEY (question_id) REFERENCES questions(id)
            )
        """)
    conn.commit()
    conn.close()

def create_candidates_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS candidates (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE
            )
        """)
    conn.commit()
    conn.close()

def create_scoring_table():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scoring (
                id INT PRIMARY KEY AUTO_INCREMENT,
                submission_id INT NOT NULL,
                question_id INT NOT NULL,
                score INT NOT NULL,
                campaign_id INT NOT NULL,
                FOREIGN KEY (submission_id) REFERENCES submissions(id),
                FOREIGN KEY (question_id) REFERENCES questions(id),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
            )
        """)
    conn.commit()
    conn.close()

@app.before_first_request
def initialize():
    create_users_table()
    create_campaigns_table()
    create_questions_table()
    create_submissions_table()
    create_submission_answers_table()
    create_candidates_table()
    create_scoring_table()  # Add this line to create the scoring table

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "INSERT INTO users (email, password, is_admin) VALUES (?, ?, ?)"
            cursor.execute(sql, (email, hashed_password, False))
        conn.commit()
        conn.close()

        flash("Registration successful! Please log in.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")

        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "SELECT * FROM users WHERE email = ?"
            cursor.execute(sql, (email,))
            user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user[2], password):  # user[2] is the password field
            session["user_id"] = user[0]  # user[0] is the id field
            session["is_admin"] = user[3]  # user[3] is the is_admin field
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

@app.route("/admin/user_manager", methods=["GET"])
@admin_required
def admin_user_manager():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT id, email, is_admin FROM users")
        users = cursor.fetchall()
    conn.close()
    return render_template("admin/user_manager/user_manager.html", users=users)


@app.route("/admin/user_manager/create", methods=["GET", "POST"])
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
            sql = "INSERT INTO users (email, password, is_admin) VALUES (?, ?, ?)"
            cursor.execute(sql, (email, hashed_password, is_admin))
        conn.commit()
        conn.close()

        flash(f"User created successfully! The password is: {password}", "success")
        return redirect(url_for("admin_user_manager"))

    return render_template("admin/user_manager/create_user.html")

@app.route("/admin/campaigns")
@admin_required
def admin_campaigns():
    conn = get_db_connection()
    with conn.cursor(dictionary=True) as cursor:
        cursor.execute("SELECT * FROM campaigns")
        campaigns = cursor.fetchall()
    conn.close()
    return render_template("admin/campaigns/campaigns.html", campaigns=campaigns)

@app.route("/admin/campaigns/create", methods=["GET", "POST"])
@admin_required
def admin_create_campaign():
    if request.method == "POST":
        title = request.form.get("title")
        max_user_submissions = request.form.get("max_user_submissions")
        questions = request.form.getlist("questions")

        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Insert the new campaign
            sql_campaign = "INSERT INTO campaigns (title, max_user_submissions) VALUES (?, ?)"
            cursor.execute(sql_campaign, (title, max_user_submissions))
            campaign_id = cursor.lastrowid

            # Insert the questions for the campaign
            for i, question in enumerate(questions):
                question_title = request.form.get(f"questions[{i}][title]")
                question_body = request.form.get(f"questions[{i}][body]")
                scoring_prompt = request.form.get(f"questions[{i}][scoring_prompt]")
                sql_question = """
                    INSERT INTO questions (campaign_id, title, body, scoring_prompt)
                    VALUES (?, ?, ?, ?)
                """
                cursor.execute(sql_question, (campaign_id, question_title, question_body, scoring_prompt))

        conn.commit()
        conn.close()

        flash("Campaign created successfully!", "success")
        return redirect(url_for("admin_campaigns"))

    return render_template("admin/campaigns/create_campaign.html")

@app.route("/admin/campaigns/<int:campaign_id>/scoring")
@admin_required
def admin_campaign_scoring(campaign_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        sql = """
        SELECT c.name as candidate_name, s.score as candidate_score
        FROM candidates c
        JOIN submissions sub ON c.id = sub.candidate_id
        JOIN scoring s ON sub.id = s.submission_id
        WHERE sub.campaign_id = ?
        """
        cursor.execute(sql, (campaign_id,))
        scoring_data = cursor.fetchall()
    conn.close()
    return render_template("admin/scoring.html", scoring_data=scoring_data, campaign_id=campaign_id)

# Interview UI
@app.route("/interview/<int:campaign_id>")
@login_required
def interview_page(campaign_id):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        sql = """
        SELECT q.id, q.question_text
        FROM questions q
        WHERE q.campaign_id = ?
        """
        cursor.execute(sql, (campaign_id,))
        questions = cursor.fetchall()
    conn.close()

    return render_template("interview/index.html", campaign_id=campaign_id, questions=questions)

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    app.run()