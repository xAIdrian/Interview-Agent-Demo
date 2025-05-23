<img align="right" width="250" src="https://github.com/user-attachments/assets/a69f22f6-5958-4cc7-921a-5570f2b060a8"/>

# AI Candidate Scoring

![CI/CD](https://github.com/KwiksFRC/NOORAIVISIO/actions/workflows/ci-cd.yml/badge.svg)


## Using the Application

Curl command to create a new admin user:
```
curl -X POST \
  https://your-api-url.com/api/admins \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

## Overview

This project is an AI-powered candidate scoring system that allows administrators to create hiring campaigns and candidates to take one-way video interviews. The system automatically scores the interviews using AI and generates detailed reports.

## Features

- **Admin Interface**: Administrators can create and manage hiring campaigns, including adding questions and scoring criteria.
- **Candidate Interface**: Candidates can participate in one-way video interviews by answering the questions provided in the campaign.
- **Automated Scoring**: The system uses AI to transcribe and score the candidate's responses based on predefined criteria.
- **Report Generation**: Detailed reports are generated for each submission, including scores and rationales for each question.

## Setup

1. Clone the repository:
    ```sh
    git clone https://github.com/your-repo/AI-Candidate-Scoring.git
    cd AI-Candidate-Scoring
    ```

2. Install the required dependencies:
    ```sh
    pip install -r requirements.txt
    ```

3. Configure environment variables:

    Create a `.env` file with the following variables:
    ```env
    OPENAI_API_KEY=your_openai_api_key
    DEEPGRAM_API_KEY=your_deepgram_api_key
    LIVEKIT_URL=your_livekit_url
    LIVEKIT_API_KEY=your_livekit_api_key
    LIVEKIT_API_SECRET=your_livekit_api_secret
    AWS_ACCESS_KEY_ID=your_aws_access_key
    AWS_SECRET_ACCESS_KEY=***REMOVED***=***REMOVED***=your_aws_secret_key
    AWS_SESSION_TOKEN=your_aws_session_token
    ```

    Configure database settings in `backend/config.py`:
    ```python
    DB_USER = "your_db_user"
    DB_PASSWORD = "your_db_password" 
    DB_HOST = "your_db_host"
    DB_PORT = "your_db_port"
    DB_NAME = "your_db_name"
    ```

4. Run the three required servers:

    a. Frontend server:
    ```sh
    cd frontend
    npm run dev
    ```

    b. Backend server:
    ```sh
    cd app
    python app.py
    ```

    c. LiveKit agent server:
    ```sh
    cd app/livekit
    python agent.py start
    ```

## Usage

### Admin Interface

1. Register and log in as an admin.
2. Create a new campaign by providing the title, context, and questions.
3. Manage users and view submissions.

### Candidate Interface

1. Log in as a candidate.
2. Participate in the interview by answering the questions in the campaign.
3. Submit the interview for automated scoring.

### Automated Scoring and Report Generation

1. The system transcribes and scores the candidate's responses using AI.
2. Detailed reports are generated and can be viewed or downloaded by the admin.

## Project Structure

- `app.py`: Main application file.
- `api_routes.py`: API routes for managing campaigns, submissions, and users.
- `database.py`: Database connection and table creation functions.
- `scoring_agent.py`: Functions for formatting questions and generating AI-based scores.
- [templates](http://_vscodecontentref_/0): HTML templates for rendering the web pages.
- `static/`: Static files like CSS and JavaScript.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

[Click here to view the project on Notion](https://www.notion.so/adrianmohnacs/Projects-Pok-dex-f99abda38000453a9f584c7139b9222b?p=19f5c918fe368117a57cd938148733b9&pm=c)


### Dependencies

Project is dependent on MariaDB you can get this running on a mac with 

make sure you install whisper with 
```
pip install git+https://github.com/openai/whisper.git
```

```
brew services start mariadb
```

### Getting LiveKit Running

**1. Agent Service 2. Flask Service 3. Flask Frontend**

Running our flask server with a work thread kicked off
```
python3 app.py
python3 agent.py dev #<- Runs our Livekit agent on independent thread.

# options
Commands:
  connect         Connect to a specific room
  dev             Start the worker in development mode
  download-files  Download plugin dependency files
  start           Start the worker in production mode.
```

Run our Next.js (frontend only) with our command:
```
npm run dev
```

[Learn about LiveKit agents](https://docs.livekit.io/agents-js/)

[Don't forget that we need to get information from the session in progress](https://docs.livekit.io/agents/voice-agent/transcriptions/)
