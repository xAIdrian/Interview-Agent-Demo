#!/usr/bin/env python

import requests
import json
import sys
from typing import List, Dict, Any, Optional

# Constants
API_BASE_URL = "http://localhost:5000/api"  # Update if your API is hosted elsewhere

def get_submission_details(submission_id: str) -> Optional[Dict[str, Any]]:
    """Fetch submission details for the provided submission ID."""
    try:
        response = requests.get(f"{API_BASE_URL}/submissions/{submission_id}")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error fetching submission: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Exception fetching submission: {e}")
        return None

def get_campaign_questions(campaign_id: str) -> List[Dict[str, Any]]:
    """Fetch questions for the given campaign ID."""
    try:
        response = requests.get(f"{API_BASE_URL}/questions?campaign_id={campaign_id}")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error fetching questions: {response.status_code}")
            print(response.text)
            return []
    except Exception as e:
        print(f"Exception fetching questions: {e}")
        return []

def submit_interview_transcript(submission_id: str, transcript: str) -> bool:
    """Submit the interview transcript to the API."""
    try:
        response = requests.post(
            f"{API_BASE_URL}/submit_interview", 
            json={
                "submission_id": str(submission_id),
                "transcript": transcript
            }
        )
        if response.status_code == 200:
            print("Transcript submitted successfully!")
            print(response.json())
            return True
        else:
            print(f"Error submitting transcript: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"Exception submitting transcript: {e}")
        return False

def generate_transcript(questions: List[Dict[str, Any]]) -> str:
    """Generate a transcript by prompting for user responses to each question."""
    print("\n=== Interview Simulation ===")
    print("For each question, enter your response. Press Enter twice to move to the next question.\n")
    
    transcript_lines = []
    interviewer_name = "Emma"  # Default interviewer name
    
    # Add introduction
    intro = f"Interviewer: Hello! I'm {interviewer_name}, and I'll be conducting your interview today. Let's get started with some questions about your experience."
    transcript_lines.append(intro)
    print(intro)
    print("\n(Press Enter to continue)")
    input()
    
    for question in questions:
        question_text = question.get("title", "")
        if not question_text:
            continue
            
        q_line = f"Interviewer: {question_text}"
        transcript_lines.append(q_line)
        print(f"\n{q_line}")
        
        # Collect user's response (multiline)
        print("\nYour response (enter a blank line when done):")
        response_lines = []
        while True:
            line = input()
            if line.strip() == "":
                if not response_lines:  # If no input yet, continue
                    continue
                break
            response_lines.append(line)
        
        response = " ".join(response_lines)
        response_line = f"Candidate: {response}"
        transcript_lines.append(response_line)
    
    # Add closing
    closing = f"Interviewer: Thank you for your time today. We'll be in touch with next steps."
    transcript_lines.append(closing)
    
    return "\n".join(transcript_lines)

def main():
    print("=== Interview Transcript Debug Tool ===")
    
    # Get submission ID
    if len(sys.argv) > 1:
        submission_id = sys.argv[1]
    else:
        submission_id = input("Enter submission ID: ")
    
    # Fetch submission details
    submission = get_submission_details(submission_id)
    if not submission:
        print("Could not retrieve submission details. Exiting.")
        return
    
    # Extract campaign ID
    campaign_id = None
    if "campaign_id" in submission:
        campaign_id = submission["campaign_id"]
    elif "submission" in submission and "campaign_id" in submission["submission"]:
        campaign_id = submission["submission"]["campaign_id"]
    
    if not campaign_id:
        print("No campaign ID found in submission. Exiting.")
        return
    
    print(f"Found campaign ID: {campaign_id}")
    
    # Fetch campaign questions
    questions = get_campaign_questions(campaign_id)
    if not questions:
        print("No questions found for campaign. Using default questions.")
        questions = [
            {"title": "Tell me about yourself"},
            {"title": "What are your strengths and weaknesses?"},
            {"title": "Why are you interested in this position?"},
            {"title": "Describe a challenge you've faced and how you overcame it"}
        ]
    
    print(f"Found {len(questions)} questions")
    
    # Generate transcript
    transcript = generate_transcript(questions)
    
    # Review transcript
    print("\n=== Generated Transcript ===")
    print(transcript)
    print("\n=== End of Transcript ===")
    
    # Confirm submission
    confirm = input("\nSubmit this transcript? (y/n): ")
    if confirm.lower() == 'y':
        submit_interview_transcript(submission_id, transcript)
    else:
        print("Submission cancelled.")
        # Save to file
        filename = f"transcript_{submission_id}.txt"
        with open(filename, "w") as f:
            f.write(transcript)
        print(f"Transcript saved to {filename}")

if __name__ == "__main__":
    main()
