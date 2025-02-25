from flask import Flask, render_template, request, redirect, url_for, flash
from config import Config
from database import get_db_connection

app = Flask(__name__)
app.config.from_object(Config)

# ---------------------------
# Admin UI
# ---------------------------
@app.route("/admin")
def admin_index():
    """
    Admin dashboard landing page
    """
    return render_template("admin/index.html")

@app.route("/admin/create_candidate", methods=["GET", "POST"])
def admin_create_candidate():
    """
    Form to manually create candidate users
    """
    if request.method == "POST":
        candidate_name = request.form.get("candidate_name")
        candidate_email = request.form.get("candidate_email")

        # Insert into DB (stubbed code)
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "INSERT INTO candidates (name, email) VALUES (%s, %s)"
            cursor.execute(sql, (candidate_name, candidate_email))
        conn.commit()
        conn.close()

        flash("Candidate created successfully!", "success")
        return redirect(url_for("admin_index"))

    return render_template("admin/create_candidate.html")

@app.route("/admin/create_admin", methods=["GET", "POST"])
def admin_create_admin():
    """
    Form to manually create admin users
    """
    if request.method == "POST":
        admin_name = request.form.get("admin_name")
        admin_email = request.form.get("admin_email")

        # Insert into DB (stubbed code)
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "INSERT INTO admins (name, email) VALUES (%s, %s)"
            cursor.execute(sql, (admin_name, admin_email))
        conn.commit()
        conn.close()

        flash("Admin user created successfully!", "success")
        return redirect(url_for("admin_index"))

    return render_template("admin/create_admin.html")

@app.route("/admin/campaigns")
def admin_campaigns():
    """
    Lists out campaigns in the system
    """
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM campaigns")
        campaigns = cursor.fetchall()
    conn.close()
    return render_template("admin/campaigns.html", campaigns=campaigns)

@app.route("/admin/campaigns/<int:campaign_id>/scoring")
def admin_campaign_scoring(campaign_id):
    """
    Lists out scoring for each candidate for a given campaign
    """
    conn = get_db_connection()
    with conn.cursor() as cursor:
        # Example query: join with candidates and scoring table
        sql = """
        SELECT c.name as candidate_name, s.score as candidate_score
        FROM candidates c
        JOIN scoring s ON c.id = s.candidate_id
        WHERE s.campaign_id = %s
        """
        cursor.execute(sql, (campaign_id,))
        scoring_data = cursor.fetchall()
    conn.close()
    return render_template("admin/scoring.html", scoring_data=scoring_data, campaign_id=campaign_id)

# ---------------------------
# Interview UI
# ---------------------------
@app.route("/interview/<int:campaign_id>")
def interview_page(campaign_id):
    """
    Displays the interview questions for a specific campaign
    """
    conn = get_db_connection()
    with conn.cursor() as cursor:
        # Example: get the questions for this campaign
        sql = """
        SELECT q.id, q.question_text
        FROM questions q
        WHERE q.campaign_id = %s
        """
        cursor.execute(sql, (campaign_id,))
        questions = cursor.fetchall()
    conn.close()

    return render_template("interview/index.html", campaign_id=campaign_id, questions=questions)

@app.route("/")
def index():
    """
    Homepage displaying the admin dashboard
    """
    return render_template("index.html")

if __name__ == "__main__":
    app.run()
