from openai import OpenAI
client = OpenAI()

answers = [
    {
        "id": "101265384061009922",
        "question_id": "101262659592126473",
        "submission_id": "14296628436638254854",
        "transcript": "My name is Anthony.",
        "video_path": "interviews/f6650106-2088-436f-9578-8caf1fd30cb9.webm"
    },
    {
        "id": "101265384061009923",
        "question_id": "101262659592126474",
        "submission_id": "14296628436638254854",
        "transcript": "I am most proud of the project where I led a team to develop a new software application that increased our company's efficiency by 30%.",
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
    campaign_title = "Chief Marketing Officer"
    campaign_context = """
I'm looking to bring on a Chief Marketing Officer to my digital agency. He should understand how to manage a team of creative directors and be decisive.
"""

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
    print(scores)