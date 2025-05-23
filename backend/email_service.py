import brevo_python
import requests
import json
import os
from brevo_python.rest import ApiException
from pprint import pprint

# Configure API key authorization
configuration = brevo_python.Configuration()
configuration.api_key["api-key"] = os.environ.get("BREVO_API_KEY")

# Configure API key authorization: partner-key
configuration.api_key["partner-key"] = os.environ.get("BREVO_API_KEY")


def get_account_info():
    # create an instance of the API class
    api_instance = brevo_python.AccountApi(brevo_python.ApiClient(configuration))

    try:
        # Get your account information, plan and credits details
        api_response = api_instance.get_account()
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling AccountApi->get_account: %s\n" % e)


def send_test_email():
    print("Sending test email")

    url = "https://api.brevo.com/v3/smtp/email"

    headers = {
        "accept": "application/json",
        "api-key": os.environ.get("BREVO_API_KEY"),
        "content-type": "application/json",
    }

    payload = {
        "sender": {"name": "Test Sender", "email": "test@example.com"},
        "to": [{"email": "amohnacs@gmail.com", "name": "Test Recipient"}],
        "subject": "Test Email from Interview Agent",
        "htmlContent": "<html><head></head><body><p>Hello,</p><p>This is a test email sent from the Interview Agent system.</p></body></html>",
    }

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()  # Raise an exception for bad status codes
        print("Email sent successfully")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error sending email: {str(e)}")
        if hasattr(e.response, "text"):
            print(f"Response text: {e.response.text}")
        raise
