import os
import re
import PyPDF2
import docx
from typing import Dict, List, Any
import json
from openai import OpenAI
from config import Config
from dotenv import load_dotenv
import io

# Initialize OpenAI client
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

# ===== MOVED PROMPTS FROM create_campaign_from_doc.py =====

# Prompt for extracting campaign context from job description
CONTEXT_EXTRACTION_PROMPT = """
Summarize the following job description into a concise context paragraph that highlights:
1. The key responsibilities of the role
2. Required skills and experience
3. Company culture or values (if mentioned)

Keep the summary professional and focused on what would be most relevant for evaluating candidates.

Job Description:
{job_description}
"""

# Prompt for generating interview questions based on job description
QUESTION_GENERATION_PROMPT = """
Based on the following job description, create {num_questions} interview questions that would help assess a candidate's fit for this role.
For each question, also provide a scoring prompt that AI can use to evaluate the candidate's response.

Format your response as JSON with the following structure:
[
    {
        "title": "Question text",
        "scoring_prompt": "Detailed scoring guidance for AI",
        "max_points": 10
    }
]

The scoring prompt should provide clear guidance on what constitutes a good answer, including:
- Key points that should be mentioned
- Types of experience or skills to look for
- Red flags or negative indicators

Job Description:
{job_description}
"""

# Default fallback questions if AI generation fails
DEFAULT_QUESTIONS = [
    {
        "title": "Tell me about your experience related to this role.",
        "scoring_prompt": "Evaluate the candidate's relevant experience and how well it aligns with the job requirements. Look for specific examples that demonstrate their skills and achievements in related areas.",
        "max_points": 10
    },
    {
        "title": "What are your key strengths that would make you successful in this position?",
        "scoring_prompt": "Assess whether the candidate's strengths align with the core requirements of the role. Strong answers will include specific examples that demonstrate these strengths in action.",
        "max_points": 10
    },
    {
        "title": "Describe a challenging situation you've faced in your previous work and how you resolved it.",
        "scoring_prompt": "Evaluate the candidate's problem-solving abilities and resilience. Look for structured approach to challenges, creative solutions, and learning from the experience.",
        "max_points": 10
    }
]

# Default number of questions to generate
DEFAULT_NUM_QUESTIONS = 5

# Maximum document size to process (characters)
MAX_DOC_SIZE = 10000

def get_campaign_templates():
    """Return a dictionary of available templates with their descriptions"""
    return {
        "standard": "General interview questions based on the job description",
        "technical": "Technical role assessment with coding and problem-solving questions",
        "leadership": "Leadership role assessment focusing on management and strategic thinking",
        "sales": "Sales role assessment focusing on communication and persuasion skills",
        "customer_service": "Customer service assessment focusing on communication and problem-solving"
    }

# ===== DOCUMENT PROCESSING FUNCTIONS =====

def extract_text_from_document(file_path: str) -> str:
    """Extract text from various document formats (PDF, DOCX, DOC, TXT)"""
    import os
    import docx
    import pymupdf
    
    extension = os.path.splitext(file_path)[1].lower()
    text = ""
    
    try:
        if extension == '.pdf':
            # Extract text from PDF using PyMuPDF
            doc = pymupdf.open(file_path)
            for page_num in range(len(doc)):
                page = doc[page_num]
                text += page.get_text()
            doc.close()
                    
        elif extension in ['.docx', '.doc']:
            # Extract text from DOCX/DOC
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
                
        elif extension == '.txt':
            # Extract text from TXT
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    text = file.read()
            except UnicodeDecodeError:
                # Try with a different encoding if UTF-8 fails
                with open(file_path, 'r', encoding='latin-1') as file:
                    text = file.read()
        else:
            raise ValueError(f"Unsupported file format: {extension}")
            
        if not text.strip():
            raise ValueError(f"No text could be extracted from the file")
            
        return text
        
    except Exception as e:
        error_message = f"Error extracting text from {extension} file: {str(e)}"
        print(error_message)
        raise ValueError(error_message)


def generate_campaign_context(text):
    """Generate a campaign context from the job description"""
    prompt = f"""
    You are a helpful HR assistant tasked with creating an interview campaign context.
    Based on the following job description, create a concise context (maximum 500 words) 
    that captures the key requirements, responsibilities, and qualifications needed.
    This context will be used to guide AI scoring of candidate video responses.
    
    Job Description:
    {text}
    
    Create a campaign context that:
    1. Summarizes the role's main purpose
    2. Highlights key skills and qualifications
    3. Outlines primary responsibilities
    4. Notes any important soft skills or culture fit aspects

    Do not include any headers. One paragraph only.
    
    Output ONLY the campaign context, no additional explanations or comments.
    """
    
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        return completion.choices[0].message.content
    except Exception as e:
        print(f"Error generating campaign context: {e}")
        return None

def generate_interview_questions(text, campaign_context):
    """Generate interview questions based on the job description"""

    prompt = f"""
    You are a recruitment specialist tasked with creating interview questions.
    Based on the job description and campaign context provided, create 5-7 interview questions 
    that will effectively assess candidates for this role.
    
    Job Description:
    {text}
    
    Campaign Context:
    {campaign_context}
    
    For each question, provide:
    1. The question itself (clear and specific)
    2. A scoring prompt to guide AI scoring (what to look for in good answers)
    3. Maximum points for the question (default 10, but make more important questions worth up to 20)

    Specify what criteria constitutes full points, half points, and no points. Be clear in your definition. Start your prompt with "Full points awarded with." Do not include the number of points in the scoring criteria.

    By default, make each question 10 points max. Make more important questions worth 20 points max.

    Create your output as a JSON array containing dictionaries without markdown. Each dictionary must include the keys: title, max_points, scoring_prompt
    
    Output ONLY the JSON array with no markdown.
    """
    
    try:

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        json_output = json.loads(completion.choices[0].message.content)
        return json_output
    except Exception as e:
        print(f"Error generating interview questions: {e}")
        return None


def generate_campaign_description(text):
    """Generate a job description for the interview campaign"""

    prompt = f"""
    Extract the job description from the following text.
    
    Job Description:
    {text}
    
    Output ONLY the job description, no additional explanations or comments.
    """
    
    try:

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        return completion.choices[0].message.content
    except Exception as e:
        print(f"Error generating interview questions: {e}")
        return None
