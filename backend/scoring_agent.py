from openai import OpenAI
import json

client = OpenAI()

def format_questions(questions):
    prompt = "# QUESTIONS AND SCORING CRITERIA"

    for question in questions:
        prompt += f"Question: {question['body']}\n"
        prompt += f"Question ID: {question['id']}\n"
        prompt += f"Scoring Criteria: {question['scoring_prompt']}\n"
        prompt += f"Maximum # of points: {question['max_points']}\n"
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

def generate_submission_scoring(campaign, questions, transcript):
    campaign_title = campaign["title"]
    campaign_context = campaign["campaign_context"]
    job_description = campaign["job_description"]

    system_prompt = f"""# CONTEXT

You are an interview scoring agent.

The company is running virtual interviews for a {campaign_title} position.

Context: {campaign_context}
Job Description: {job_description}

# QUESTIONS, IDS, SCORING CRITERIA
{format_questions(questions)}

# TASK/OVERVIEW
A candidate has submitted a video interview answering a series of questions.

For each question, you will be given a scoring criteria, maximum number of points, and response.

You will create a JSON array containing a dictionary representing each of your answers. Within each dictionary, include the following keys in this order:
- question: Repeat the original question prompt.
- question_id: The ID of the question. Match this to the question ID in the questions array.
- response: Provide the candidate's response. Copy and paste the transcript segment that corresponds to the question.
- rationale: Provide an in-depth analysis of the candidate's response and whether it satisfies the scoring criteria given the context described above.
- score: Provide a numerical score between 0 and the maximum number of points based on your rationale. Full points should be awarded for responses that fully satisfy the scoring criteria.

Your rationale should take into consideration the requirements of the {campaign_title} position and the context provided.

Provide only the JSON array in plaintext. Do not use any markdown functionality.

# INTERVIEW TRANSCRIPT
{transcript}

\n\n"""

    user_prompt = format_questions(questions)
    scores = openai_response(system_prompt, user_prompt)
    scores_json = json.loads(scores)
    return scores_json





scoring_prompt_optimization_system = """Optimize this scoring prompt created by an admin to score a candidate's response.

Specify what criteria constitutes full points, half points, and no points. Be clear in your definition. Start your prompt with "Full points awarded with"

Only output your updated scoring prompt

--

Hiring Campaign: {campaign_name}
Role information: {campaign_context}
Question: {question}
Original scoring prompt: {scoring_prompt}

"""

def optimize_with_ai(campaign_name, campaign_context, question, scoring_prompt):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": scoring_prompt_optimization_system.format(
                    campaign_name=campaign_name,
                    campaign_context=campaign_context,
                    question=question,
                    scoring_prompt=scoring_prompt
                )
            }
        ]
    )
    return completion.choices[0].message.content
