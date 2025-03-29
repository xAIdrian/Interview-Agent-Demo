from livekit.agents import llm
import enum
from typing import Annotated, List
import logging
import sqlite3
import os
from dataclasses import dataclass

logger = logging.getLogger("interview-api")
logger.setLevel(logging.INFO)

# Define database path
DB_PATH = os.path.join(os.path.dirname(__file__), 'interview_db.sqlite')

@dataclass
class Candidate:
    email: str
    name: str
    position: str
    experience: int

class DatabaseDriver:
    def __init__(self):
        self.init_db()
        
    def init_db(self):
        # Create database if it doesn't exist
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Create table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS candidates (
            email TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position TEXT NOT NULL,
            experience INTEGER NOT NULL
        )
        ''')
        
        conn.commit()
        conn.close()
        
    def get_candidate_by_email(self, email: str) -> Candidate:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT email, name, position, experience FROM candidates WHERE email = ?', (email,))
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            return Candidate(
                email=result[0],
                name=result[1],
                position=result[2],
                experience=result[3]
            )
        return None
    
    def create_candidate(self, email: str, name: str, position: str, experience: int) -> Candidate:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                'INSERT INTO candidates (email, name, position, experience) VALUES (?, ?, ?, ?)',
                (email, name, position, experience)
            )
            conn.commit()
            
            return Candidate(
                email=email,
                name=name,
                position=position,
                experience=experience
            )
        except sqlite3.IntegrityError:
            # If the candidate already exists, update their info
            cursor.execute(
                'UPDATE candidates SET name = ?, position = ?, experience = ? WHERE email = ?',
                (name, position, experience, email)
            )
            conn.commit()
            
            return Candidate(
                email=email,
                name=name,
                position=position,
                experience=experience
            )
        finally:
            conn.close()

class CandidateDetails(enum.Enum):
    Email = "email"
    Name = "name"
    Position = "position"
    Experience = "experience"
    
class InterviewStage(enum.Enum):
    Introduction = "introduction"
    TechnicalQuestions = "technical_questions"
    BehavioralQuestions = "behavioral_questions"
    Closing = "closing"

class AssistantFnc(llm.FunctionContext):
    def __init__(self):
        super().__init__()
        
        self._candidate_details = {
            CandidateDetails.Email: "",
            CandidateDetails.Name: "",
            CandidateDetails.Position: "",
            CandidateDetails.Experience: ""
        }
        
        self._current_stage = InterviewStage.Introduction
        self._question_index = 0
        self._db = DatabaseDriver()
        
        # Define interview questions by position
        self._questions = {
            "software engineer": {
                InterviewStage.TechnicalQuestions: [
                    "Can you explain the difference between an array and a linked list?",
                    "What is the time complexity of binary search?",
                    "Explain the concept of recursion and provide a simple example."
                ],
                InterviewStage.BehavioralQuestions: [
                    "Tell me about a time when you had to work under pressure to meet a deadline.",
                    "Describe a situation where you had to resolve a conflict within your team.",
                    "How do you handle feedback on your work?"
                ]
            },
            "data scientist": {
                InterviewStage.TechnicalQuestions: [
                    "Explain the difference between supervised and unsupervised learning.",
                    "How would you handle missing data in a dataset?",
                    "What evaluation metrics would you use for a classification problem?"
                ],
                InterviewStage.BehavioralQuestions: [
                    "Tell me about a data-driven project you're particularly proud of.",
                    "How do you communicate technical results to non-technical stakeholders?",
                    "How do you ensure your analysis is unbiased?"
                ]
            },
            "product manager": {
                InterviewStage.TechnicalQuestions: [
                    "How do you prioritize features for a product?",
                    "Explain how you would conduct user research for a new product.",
                    "How do you measure the success of a product?"
                ],
                InterviewStage.BehavioralQuestions: [
                    "Tell me about a time when you had to make a difficult product decision.",
                    "How do you handle stakeholder disagreements?",
                    "Describe a situation where you had to pivot a product strategy."
                ]
            }
        }
    
    def get_candidate_str(self):
        candidate_str = ""
        for key, value in self._candidate_details.items():
            candidate_str += f"{key.value}: {value}\n"
            
        return candidate_str
    
    @llm.ai_callable(description="lookup a candidate by their email")
    def lookup_candidate(self, email: Annotated[str, llm.TypeInfo(description="The email of the candidate to lookup")]):
        logger.info("lookup candidate - email: %s", email)
        
        result = self._db.get_candidate_by_email(email)
        if result is None:
            return "Candidate not found"
        
        self._candidate_details = {
            CandidateDetails.Email: result.email,
            CandidateDetails.Name: result.name,
            CandidateDetails.Position: result.position,
            CandidateDetails.Experience: result.experience
        }
        
        return f"Candidate found: {self.get_candidate_str()}"
    
    @llm.ai_callable(description="get the details of the current candidate")
    def get_candidate_details(self):
        logger.info("get candidate details")
        return f"The candidate details are: {self.get_candidate_str()}"
    
    @llm.ai_callable(description="create a new candidate profile")
    def create_candidate(
        self, 
        email: Annotated[str, llm.TypeInfo(description="The email of the candidate")],
        name: Annotated[str, llm.TypeInfo(description="The name of the candidate")],
        position: Annotated[str, llm.TypeInfo(description="The position the candidate is applying for")],
        experience: Annotated[int, llm.TypeInfo(description="The years of experience of the candidate")]
    ):
        logger.info("create candidate - email: %s, name: %s, position: %s, experience: %s", email, name, position, experience)
        result = self._db.create_candidate(email, name, position, experience)
        if result is None:
            return "Failed to create candidate profile"
        
        self._candidate_details = {
            CandidateDetails.Email: result.email,
            CandidateDetails.Name: result.name,
            CandidateDetails.Position: result.position,
            CandidateDetails.Experience: result.experience
        }
        
        return "Candidate profile created successfully!"
    
    @llm.ai_callable(description="get the next interview question")
    def get_next_question(self):
        if not self.has_candidate():
            return "Please register the candidate first"
        
        position = self._candidate_details[CandidateDetails.Position].lower()
        
        # Default to software engineer questions if position not found
        if position not in self._questions:
            position = "software engineer"
            
        if self._current_stage == InterviewStage.Introduction:
            self._current_stage = InterviewStage.TechnicalQuestions
            self._question_index = 0
            return self._questions[position][self._current_stage][self._question_index]
        
        questions = self._questions[position][self._current_stage]
        
        if self._question_index < len(questions) - 1:
            self._question_index += 1
        elif self._current_stage == InterviewStage.TechnicalQuestions:
            self._current_stage = InterviewStage.BehavioralQuestions
            self._question_index = 0
        elif self._current_stage == InterviewStage.BehavioralQuestions:
            self._current_stage = InterviewStage.Closing
            return "That concludes all our questions. Do you have any questions for us?"
        
        if self._current_stage == InterviewStage.Closing:
            return "The interview has concluded. Thank you for your time."
            
        return self._questions[position][self._current_stage][self._question_index]
    
    def has_candidate(self):
        return self._candidate_details[CandidateDetails.Email] != "" 