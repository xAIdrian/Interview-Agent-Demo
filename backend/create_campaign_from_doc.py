import os
from openai import OpenAI
from docx import Document
import PyPDF2
import re
import json

def extract_text_from_docx(file_path):
    """Extract text from a .docx file"""
    doc = Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return '\n'.join(full_text)

def extract_text_from_pdf(file_path):
    """Extract text from a .pdf file"""
    text = ""
    with open(file_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        for page in pdf_reader.pages:
            text += page.extract_text()
    return text

def extract_text_from_txt(file_path):
    """Extract text from a .txt file"""
    with open(file_path, 'r', encoding='utf-8') as file:
        return file.read()

def extract_text_from_file(file_path):
    """Extract text from a file based on its extension"""
    extension = os.path.splitext(file_path)[1].lower()
    
    if extension == '.docx':
        return extract_text_from_docx(file_path)
    elif extension == '.pdf':
        return extract_text_from_pdf(file_path)
    elif extension == '.txt':
        return extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {extension}")

def generate_campaign_context(text):
    client = OpenAI()

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
    client = OpenAI()

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

    Create your output as a JSON array containing dictionaries without markdown. Each dictionary must include the keys: question, max_points, scoring_prompt
    
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
