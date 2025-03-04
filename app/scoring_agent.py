from openai import OpenAI
import json

client = OpenAI()

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

def generate_submission_scoring(campaign, questions, answers):
    campaign_title = campaign["title"]
    campaign_context = campaign["campaign_context"]

    system_prompt = f"""# CONTEXT

You are an interview scoring agent.

The company is running virtual interviews for a {campaign_title} position.

Their requirements are: {campaign_context}

# TASK/OVERVIEW
A candidate has submitted a video interview answering a series of questions.

For each question, you will be given a scoring criteria, maximum number of points, and response.

You will create a JSON array containing a dictionary representing each of your answers. Within each dictionary, include the following keys in this order:
- question: Repeat the original question prompt.
- response: Provide the candidate's response.
- rationale: Provide an in-depth analysis of the candidate's response and whether it satisfies the scoring criteria given the context described above.
- score: Provide a numerical score between 0 and the maximum number of points based on your rationale. Full points should be awarded for responses that fully satisfy the scoring criteria.

Your rationale should take into consideration the requirements of the {campaign_title} position and the context provided.

Provide only the JSON array in plaintext. Do not use any markdown functionality.

\n\n"""

    user_prompt = format_questions(questions, answers)
    scores = openai_response(system_prompt, user_prompt)
    scores_json = json.loads(scores)
    return scores_json