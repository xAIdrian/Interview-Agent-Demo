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


def send_batch_emails(subject, base_html_content, message_versions):
    """
    Send multiple emails in a single API call using Brevo's batch sending functionality.

    Args:
        subject: Default subject line
        base_html_content: Base HTML template
        message_versions: List of dictionaries containing recipient-specific content
    """
    url = "https://api.brevo.com/v3/smtp/email"

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "subject": subject,
        "htmlContent": base_html_content,
        "messageVersions": message_versions,
    }

    try:
        print(f"Sending batch email with {len(message_versions)} versions")
        print(f"Using API key: {BREVO_API_KEY[:5]}...")
        print(f"Request headers: {headers}")
        print(f"Request payload: {json.dumps(payload, indent=2)}")

        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        print(f"Batch email sent successfully")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error sending batch email: {str(e)}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response status code: {e.response.status_code}")
            print(f"Response headers: {e.response.headers}")
            print(f"Response text: {e.response.text}")
        raise


def send_interview_invitations(emails, campaign_title, interview_link, access_code):
    """
    Send interview invitations to multiple recipients in a single batch.

    Args:
        emails: List of email addresses
        campaign_title: Title of the campaign
        interview_link: Link to the interview
        access_code: Access code for the interview
    """
    subject = f"NoorAI Interview Invitation: {campaign_title}"

    # Base HTML template with variables
    base_html_content = """
    <!DOCTYPE html>
    <html>
    <body>
        <h2>Interview Invitation</h2>
        <p>You have been invited to participate in an interview for the <strong>{{params.campaign_title}}</strong> position.</p>
        <p>Please click the following link to start your interview:</p>
        <p><a href="{{params.interview_link}}">{{params.interview_link}}</a></p>
        <p>Here is your access code: <strong>{{params.access_code}}</strong></p>
        <p>Best regards,<br>The Interview Team</p>
    </body>
    </html>
    """

    # Create message versions for each email
    message_versions = []
    for email in emails:
        recipient_name = email.split("@")[0].replace(".", " ").title()
        message_versions.append(
            {
                "to": [{"email": email, "name": recipient_name}],
                "params": {
                    "recipient_name": recipient_name,
                    "campaign_title": campaign_title,
                    "interview_link": interview_link,
                    "access_code": access_code,
                },
            }
        )

    return send_batch_emails(subject, base_html_content, message_versions)


def send_interview_completion(recipient_email, campaign_title, submission_link):
    """
    Send an interview completion notification email.
    """
    subject = f"Interview Completed: {campaign_title}"
    recipient_name = recipient_email.split("@")[0].replace(".", " ").title()

    # HTML version
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body>
        <h2>Interview Completed</h2>
        <p>Thank you for completing the interview for the <strong>{campaign_title}</strong> position.</p>
        <p>You can view your submission at:</p>
        <p><a href="{submission_link}">{submission_link}</a></p>
        <p>Best regards,<br>The Interview Team</p>
    </body>
    </html>
    """

    # Create a single message version for completion email
    message_versions = [
        {
            "to": [{"email": recipient_email, "name": recipient_name}],
            "htmlContent": html_content,
        }
    ]

    return send_batch_emails(subject, html_content, message_versions)
