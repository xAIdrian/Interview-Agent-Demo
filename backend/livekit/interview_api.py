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
        
        # Create questions table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            position TEXT NOT NULL,
            stage TEXT NOT NULL,
            question TEXT NOT NULL
        )
        ''')
        
        # Insert default questions if the table is empty
        cursor.execute('SELECT COUNT(*) FROM questions')
        if cursor.fetchone()[0] == 0:
            # Default questions for software engineer
            software_engineer_technical = [
                "Can you explain the difference between an array and a linked list?",
                "What is the time complexity of binary search?",
                "Explain the concept of recursion and provide a simple example."
            ]
            software_engineer_behavioral = [
                "Tell me about a time when you had to work under pressure to meet a deadline.",
                "Describe a situation where you had to resolve a conflict within your team.",
                "How do you handle feedback on your work?"
            ]
            
            # Default questions for data scientist
            data_scientist_technical = [
                "Explain the difference between supervised and unsupervised learning.",
                "How would you handle missing data in a dataset?",
                "What evaluation metrics would you use for a classification problem?"
            ]
            data_scientist_behavioral = [
                "Tell me about a data-driven project you're particularly proud of.",
                "How do you communicate technical results to non-technical stakeholders?",
                "How do you ensure your analysis is unbiased?"
            ]
            
            # Default questions for product manager
            product_manager_technical = [
                "How do you prioritize features for a product?",
                "Explain how you would conduct user research for a new product.",
                "How do you measure the success of a product?"
            ]
            product_manager_behavioral = [
                "Tell me about a time when you had to make a difficult product decision.",
                "How do you handle stakeholder disagreements?",
                "Describe a situation where you had to pivot a product strategy."
            ]
            
            # Insert default questions
            questions_to_insert = []
            for position, stage, questions in [
                ("software engineer", "technical_questions", software_engineer_technical),
                ("software engineer", "behavioral_questions", software_engineer_behavioral),
                ("data scientist", "technical_questions", data_scientist_technical),
                ("data scientist", "behavioral_questions", data_scientist_behavioral),
                ("product manager", "technical_questions", product_manager_technical),
                ("product manager", "behavioral_questions", product_manager_behavioral)
            ]:
                for question in questions:
                    questions_to_insert.append((position, stage, question))
            
            cursor.executemany(
                'INSERT INTO questions (position, stage, question) VALUES (?, ?, ?)',
                questions_to_insert
            )
        
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
            
    def get_questions_for_position_and_stage(self, position: str, stage: str) -> List[str]:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT question FROM questions WHERE position = ? AND stage = ?', (position.lower(), stage))
        results = cursor.fetchall()
        
        conn.close()
        
        if results:
            return [result[0] for result in results]
        return []

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
        
        # We'll now load questions dynamically from the database
        # Rather than having them hardcoded
        
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
        
        # Default to software engineer if position not found
        if position not in ["software engineer", "data scientist", "product manager"]:
            position = "software engineer"
            
        if self._current_stage == InterviewStage.Introduction:
            self._current_stage = InterviewStage.TechnicalQuestions
            self._question_index = 0
            
            # Get questions for this position and stage from database
            questions = self._db.get_questions_for_position_and_stage(position, self._current_stage.value)
            if questions and self._question_index < len(questions):
                return questions[self._question_index]
            return "No technical questions available for this position."
        
        current_stage_questions = self._db.get_questions_for_position_and_stage(position, self._current_stage.value)
        
        if self._question_index < len(current_stage_questions) - 1:
            self._question_index += 1
            return current_stage_questions[self._question_index]
        elif self._current_stage == InterviewStage.TechnicalQuestions:
            self._current_stage = InterviewStage.BehavioralQuestions
            self._question_index = 0
            
            # Get questions for the new stage
            new_questions = self._db.get_questions_for_position_and_stage(position, self._current_stage.value)
            if new_questions and self._question_index < len(new_questions):
                return new_questions[self._question_index]
            return "No behavioral questions available for this position."
        elif self._current_stage == InterviewStage.BehavioralQuestions:
            self._current_stage = InterviewStage.Closing
            return "That concludes all our questions. Do you have any questions for us?"
        
        if self._current_stage == InterviewStage.Closing:
            return "The interview has concluded. Thank you for your time."
            
        return "No more questions available."
    
    @llm.ai_callable(description="add a new interview question")
    def add_interview_question(
        self,
        position: Annotated[str, llm.TypeInfo(description="The position this question is for (e.g., software engineer, data scientist, product manager)")],
        stage: Annotated[str, llm.TypeInfo(description="The interview stage (technical_questions or behavioral_questions)")],
        question: Annotated[str, llm.TypeInfo(description="The question text")]
    ):
        logger.info("Adding new question for %s at stage %s: %s", position, stage, question)
        
        if stage not in ["technical_questions", "behavioral_questions"]:
            return "Invalid stage. Must be 'technical_questions' or 'behavioral_questions'."
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                'INSERT INTO questions (position, stage, question) VALUES (?, ?, ?)',
                (position.lower(), stage, question)
            )
            conn.commit()
            return f"Question added successfully for {position} in the {stage} stage."
        except Exception as e:
            return f"Failed to add question: {str(e)}"
        finally:
            conn.close()
    
    def has_candidate(self):
        return self._candidate_details[CandidateDetails.Email] != "" 