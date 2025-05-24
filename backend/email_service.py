import os
import json
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API key from environment
BREVO_API_KEY = os.getenv("BREVO_API_KEY")
if not BREVO_API_KEY:
    raise ValueError("BREVO_API_KEY environment variable is not set")

print(f"API Key loaded: {BREVO_API_KEY[:5]}...")  # Print first 5 chars for debugging

BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "Karim.kaoukabi@gmail.com")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "Karim @ NoorAI")


def send_email(subject, body, to_email, to_name=None):
    """
    Send an email using Brevo's API.

    Args:
        subject: Email subject
        body: Plain text email body
        to_email: Recipient email address
        to_name: Recipient name (optional)
    """
    url = "https://api.brevo.com/v3/smtp/email"

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name or to_email.split("@")[0]}],
        "subject": subject,
        "htmlContent": f"<html><body>{body}</body></html>",
    }

    try:
        print(f"Sending email to {to_email}")
        print(f"Using API key: {BREVO_API_KEY[:5]}...")
        print(f"Request headers: {headers}")
        print(f"Request payload: {json.dumps(payload, indent=2)}")

        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        print(f"Email sent to {to_email}")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error sending email: {str(e)}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response status code: {e.response.status_code}")
            print(f"Response headers: {e.response.headers}")
            print(f"Response text: {e.response.text}")
        raise


def send_email_with_html(subject, body, html_content, to_email, to_name=None):
    """
    Send an email with both plain text and HTML content using Brevo's API.

    Args:
        subject: Email subject
        body: Plain text email body
        html_content: HTML version of the email
        to_email: Recipient email address
        to_name: Recipient name (optional)
    """
    url = "https://api.brevo.com/v3/smtp/email"

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name or to_email.split("@")[0]}],
        "subject": subject,
        "htmlContent": html_content,
        "textContent": body,
    }

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        print(f"Email sent to {to_email}")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error sending email: {str(e)}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response text: {e.response.text}")
        raise


def send_interview_invitation(
    recipient_email, campaign_title, interview_link, access_code
):
    """
    Send an interview invitation email.
    """
    subject = f"NoorAI Interview Invitation: {campaign_title}"
    recipient_name = recipient_email.split("@")[0].replace(".", " ").title()

    # Plain text version
    body = f"""
You have been invited to participate in an interview for the {campaign_title} position.

Please click the following link to start your interview:
{interview_link}

Here is your access code: {access_code}

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
    <p>Here is your access code: <strong>{access_code}</strong></p>
    <p>Best regards,<br>The Interview Team</p>
</body>
</html>
"""

    return send_email_with_html(
        subject, body, html_content, recipient_email, recipient_name
    )


def send_interview_completion(recipient_email, campaign_title, submission_link):
    """
    Send an interview completion notification email.
    """
    subject = f"Interview Completed: {campaign_title}"
    recipient_name = recipient_email.split("@")[0].replace(".", " ").title()

    # Plain text version
    body = f"""
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

    return send_email_with_html(
        subject, body, html_content, recipient_email, recipient_name
    )
