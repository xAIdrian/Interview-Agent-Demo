from openai import OpenAI
client = OpenAI()

answers = [
    {
        "id": "101265384061009922",
        "question_id": "101262659592126473",
        "submission_id": "14296628436638254854",
        "transcript": "Okay, so you're testing out the interview room functionality.",
        "video_path": "interviews/f6650106-2088-436f-9578-8caf1fd30cb9.webm"
    },
    {
        "id": "101265384061009923",
        "question_id": "101262659592126474",
        "submission_id": "14296628436638254854",
        "transcript": "And here is my answer to question number two.",
        "video_path": "interviews/93aa981e-7b34-4ec4-93cd-adfd71df7fbd.webm"
    }
]

questions = [
  {
    "body": "What is your name?",
    "campaign_id": "3181975812688726599",
    "id": "101262659592126473",
    "max_points": 5,
    "scoring_prompt": "Full points if the candidate provides his/her real name.",
    "title": "What is your name?"
  },
  {
    "body": "What project are you most proud of?",
    "campaign_id": "3181975812688726599",
    "id": "101262659592126474",
    "max_points": 5,
    "scoring_prompt": "Full points if the candidate provides a detailed explanation of a project they have worked on.",
    "title": "What project are you most proud of?"
  }
]

def format_questions(questions, answers):
    prompt = "# QUESTIONS AND RESPONSES"

    for question in questions:
        prompt += f"Question: {question['body']}\n"
        prompt += f"Scoring Criteria: {question['scoring_prompt']}\n"
        prompt += f"Maximum # of points: {question['max_points']}\n"
        answer = next((a for a in answers if a['question_id'] == question['id']), None)
        if answer:
            prompt += f"Response: {answer['transcript']}\n"
        else:
            prompt += "Response: No response provided.\n"
        prompt += "\n"
    return prompt

def openai_response(system_prompt, user_prompt):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )
    return completion.choices[0].message.content

if __name__ == "__main__":
    system_prompt = """# TASK/OVERVIEW

You are an interview scoring agent. A candidate has submitted a video interview answering a series of questions.

Based on the following questions, scoring criteria, maximum number of points, and response, give each question a score.\n\n"""

    user_prompt = format_questions(questions, answers)
    scores = openai_response(system_prompt, user_prompt)
    print(scores)