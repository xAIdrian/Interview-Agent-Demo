import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get SMTP API key from environment
SMTP_API_KEY = os.getenv("SMTP_API_KEY")


def send_email(subject, body, to_email):
    """
    Send an email using Brevo's SMTP service.

    Args:
        subject: Email subject
        body: Plain text email body
        to_email: Recipient email address
    """
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "your_email@example.com"  # Use your verified Sendinblue sender
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP("smtp-relay.sendinblue.com", 587) as server:
            server.starttls()
            server.login("your_email@example.com", SMTP_API_KEY)
            server.send_message(msg)
            print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Error: {e}")


def send_email_with_html(subject, body, html_content, to_email):
    """
    Send an email with both plain text and HTML content.

    Args:
        subject: Email subject
        body: Plain text email body
        html_content: HTML version of the email
        to_email: Recipient email address
    """
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "your_email@example.com"  # Use your verified Sendinblue sender
    msg["To"] = to_email

    # Set plain text content
    msg.set_content(body)

    # Add HTML content
    msg.add_alternative(html_content, subtype="html")

    try:
        with smtplib.SMTP("smtp-relay.sendinblue.com", 587) as server:
            server.starttls()
            server.login("your_email@example.com", SMTP_API_KEY)
            server.send_message(msg)
            print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Error: {e}")


def send_interview_invitation(
    recipient_email, recipient_name, campaign_title, interview_link
):
    """
    Send an interview invitation email.
    """
    subject = f"Interview Invitation: {campaign_title}"

    # Plain text version
    body = f"""
Dear {recipient_name},

You have been invited to participate in an interview for the {campaign_title} position.

Please click the following link to start your interview:
{interview_link}

Best regards,
The Interview Team
"""

    # HTML version
    html_content = f"""
<html>
<body>
    <h2>Interview Invitation</h2>
    <p>Dear {recipient_name},</p>
    <p>You have been invited to participate in an interview for the <strong>{campaign_title}</strong> position.</p>
    <p>Please click the following link to start your interview:</p>
    <p><a href="{interview_link}">{interview_link}</a></p>
    <p>Best regards,<br>The Interview Team</p>
</body>
</html>
"""

    send_email_with_html(subject, body, html_content, recipient_email)


def send_interview_completion(
    recipient_email, recipient_name, campaign_title, submission_link
):
    """
    Send an interview completion notification email.
    """
    subject = f"Interview Completed: {campaign_title}"

    # Plain text version
    body = f"""
Dear {recipient_name},

Thank you for completing the interview for the {campaign_title} position.

You can view your submission at:
{submission_link}

Best regards,
The Interview Team
"""

    # HTML version
    html_content = f"""
<html>
<body>
    <h2>Interview Completed</h2>
    <p>Dear {recipient_name},</p>
    <p>Thank you for completing the interview for the <strong>{campaign_title}</strong> position.</p>
    <p>You can view your submission at:</p>
    <p><a href="{submission_link}">{submission_link}</a></p>
    <p>Best regards,<br>The Interview Team</p>
</body>
</html>
"""

    send_email_with_html(subject, body, html_content, recipient_email)
