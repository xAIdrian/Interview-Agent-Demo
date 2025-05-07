from openai import OpenAI
import json
import logging

client = OpenAI()
logger = logging.getLogger(__name__)


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
            {"role": "user", "content": user_prompt},
        ],
    )
    return completion.choices[0].message.content


def generate_submission_scoring(campaign, questions, transcript):
    campaign_title = campaign["title"]
    campaign_context = campaign["campaign_context"]
    job_description = campaign["job_description"]

    # Process transcript to extract candidate responses
    candidate_responses = {}
    current_question = None
    current_response = []

    # Process each line of the transcript
    for entry in transcript:
        if not isinstance(entry, dict):
            continue

        text = entry.get("text", "").strip()
        entry_type = entry.get("type", "")

        if not text:
            continue

        # Check if this is a question (from agent)
        if entry_type == "agent" and "?" in text:
            if current_question and current_response:
                candidate_responses[current_question] = "\n".join(current_response)
            current_question = text
            current_response = []
        # Check if this is a candidate response
        elif entry_type == "user":
            current_response.append(text)

    # Add the last response if exists
    if current_question and current_response:
        candidate_responses[current_question] = "\n".join(current_response)

    system_prompt = f"""
THE OUTPUT MUST ALWAYS BE IN FRENCH.
    
# CONTEXT

You are an interview scoring agent.

The company is running virtual interviews for a {campaign_title} position.

Context: {campaign_context}
Job Description: {job_description}

# QUESTIONS, IDS, SCORING CRITERIA
{format_questions(questions)}

# TASK/OVERVIEW
A candidate has submitted a video interview answering a series of questions.

For each question, you will be given a scoring criteria, maximum number of points, and the candidate's response.

You will create a JSON array containing a dictionary representing each of your answers. Within each dictionary, include the following keys in this order:
- question: Repeat the original question prompt.
- question_id: The ID of the question. Match this to the question ID in the questions array.
- response: Provide the candidate's response. Copy and paste the transcript segment that corresponds to the question.
- rationale: Provide an in-depth analysis of the candidate's response and whether it satisfies the scoring criteria given the context described above.
- score: Provide a numerical score between 0 and the maximum number of points based on your rationale. Full points should be awarded for responses that fully satisfy the scoring criteria.

Your rationale should take into consideration the requirements of the {campaign_title} position and the context provided.

Your task is to score each answer on a scale, not just with binary pass/fail outcomes.

Use scaled scoring where partial alignment with the ideal answer earns proportionate credit. 
For example: if a candidate requests a salary of $70k and the ideal is $50k, do not score them zero — instead, assign them most of the possible points based on proximity. 
Apply this principle across all answers.  Quantitative and qualitative should use the same scale.


Provide only the JSON array in plaintext. Do not use any markdown functionality.

# CANDIDATE RESPONSES
{json.dumps(candidate_responses, indent=2)}

THE OUTPUT MUST ALWAYS BE IN FRENCH.
\n\n"""

    user_prompt = format_questions(questions)
    scores = openai_response(system_prompt, user_prompt)

    # Ensure scores is a valid JSON string before parsing
    if not isinstance(scores, str):
        scores = str(scores)

    try:
        scores_json = json.loads(scores)
        return scores_json
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse scoring response: {e}")
        logger.error(f"Raw response: {scores}")
        raise ValueError("Invalid scoring response format")


scoring_prompt_optimization_system = """
THE OUTPUT MUST ALWAYS BE IN FRENCH.

Optimize this scoring prompt created by an admin to score a candidate's response.

Specify what criteria constitutes full points, half points, and no points. Be clear in your definition. Start your prompt with "Full points awarded with"

Only output your updated scoring prompt

--

Hiring Campaign: {campaign_name}
Role information: {campaign_context}
Question: {question}
Original scoring prompt: {scoring_prompt}

THE OUTPUT MUST ALWAYS BE IN FRENCH.
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
                    scoring_prompt=scoring_prompt,
                ),
            }
        ],
    )
    return completion.choices[0].message.content


def analyze_strengths_weaknesses(campaign, resume_text):
    """
    Analyzes a candidate's resume against the job description to identify strengths and weaknesses.

    Args:
        campaign: Dictionary containing campaign details (title, context, job_description)
        resume_text: String containing the extracted text from the candidate's resume

    Returns:
        Dictionary containing strengths, weaknesses, and overall fit assessment
    """
    try:
        logger.info("Starting resume analysis")
        if not resume_text or not isinstance(resume_text, str):
            raise ValueError("Invalid resume text provided")

        if not campaign or not isinstance(campaign, dict):
            raise ValueError("Invalid campaign data provided")

        required_campaign_fields = ["title", "campaign_context", "job_description"]
        for field in required_campaign_fields:
            if field not in campaign:
                raise ValueError(f"Missing required campaign field: {field}")

        campaign_title = campaign["title"]
        campaign_context = campaign["campaign_context"]
        job_description = campaign["job_description"]

        system_prompt = f"""
THE OUTPUT MUST ALWAYS BE IN FRENCH.

# CONTEXT
You are an expert resume analyzer and career advisor.

The company is hiring for a {campaign_title} position.

Context: {campaign_context}
Job Description: {job_description}

# TASK
Analyze the candidate's resume against the job requirements and provide:
1. Key strengths that make them a good fit
2. Potential weaknesses or gaps (do not make these too critical or negative.  Soften the language so you don't hurt the candidate's feelings)
3. Overall assessment of their fit for the role

Consider:
- Required skills and experience
- Educational background
- Industry experience
- Technical competencies
- Soft skills and leadership qualities

Format your response as a JSON object with the following structure:
{{
    "strengths": ["list of key strengths"],
    "weaknesses": ["list of potential gaps or weaknesses"],
    "overall_fit": "brief assessment of overall fit (1-2 sentences)",
    "fit_score": number between 0 and 100,
    "fit_reason": "brief explanation of the fit score"
}}

# RESUME
{resume_text}

THE OUTPUT MUST ALWAYS BE IN FRENCH.
\n\n"""

        user_prompt = """
Analyze this resume against the job requirements and provide strengths, weaknesses, and overall fit assessment.

THE OUTPUT MUST ALWAYS BE IN FRENCH.
"""

        analysis = openai_response(system_prompt, user_prompt)
        logger.info(f"Received analysis from OpenAI: {analysis}")

        try:
            # Clean the response by removing markdown code block markers
            cleaned_analysis = analysis.strip()
            if cleaned_analysis.startswith("```json"):
                cleaned_analysis = cleaned_analysis[7:]  # Remove ```json
            if cleaned_analysis.endswith("```"):
                cleaned_analysis = cleaned_analysis[:-3]  # Remove ```
            cleaned_analysis = cleaned_analysis.strip()

            analysis_json = json.loads(cleaned_analysis)
            logger.info("Successfully parsed analysis JSON")
            return analysis_json
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse analysis JSON: {e}")
            logger.error(f"Raw analysis: {analysis}")
            raise ValueError("Invalid JSON response from analysis")

    except Exception as e:
        logger.error(f"Error in analyze_strengths_weaknesses: {str(e)}")
        raise
