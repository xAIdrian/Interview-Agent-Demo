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
DB_PATH = os.path.join(os.path.dirname(__file__), "interview_db.sqlite")


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
        cursor.execute(
            """
        CREATE TABLE IF NOT EXISTS candidates (
            email TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position TEXT NOT NULL,
            experience INTEGER NOT NULL
        )
        """
        )

        # Create questions table if it doesn't exist
        cursor.execute(
            """
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            position TEXT NOT NULL,
            stage TEXT NOT NULL,
            question TEXT NOT NULL
        )
        """
        )

        # Insert sample candidates if the table is empty
        cursor.execute("SELECT COUNT(*) FROM candidates")
        if cursor.fetchone()[0] == 0:
            sample_candidates = [
                ("john.doe@example.com", "John Doe", "virtual assistant", 0),
                (
                    "sarah.smith@example.com",
                    "Sarah Smith",
                    "customer service representative",
                    1,
                ),
                ("mike.wilson@example.com", "Mike Wilson", "data entry specialist", 0),
                ("emma.brown@example.com", "Emma Brown", "virtual assistant", 1),
                (
                    "alex.jones@example.com",
                    "Alex Jones",
                    "customer service representative",
                    0,
                ),
                (
                    "david.lee@example.com",
                    "David Lee",
                    "construction on-site engineer",
                    1,
                ),
                ("lisa.chen@example.com", "Lisa Chen", "data scientist", 0),
            ]
            cursor.executemany(
                "INSERT INTO candidates (email, name, position, experience) VALUES (?, ?, ?, ?)",
                sample_candidates,
            )

        # Insert default questions if the table is empty
        cursor.execute("SELECT COUNT(*) FROM questions")
        if cursor.fetchone()[0] == 0:
            # Entry-level questions for virtual assistant
            virtual_assistant_technical = [
                "What computer programs or tools are you familiar with?",
                "How do you organize and manage your tasks?",
                "What experience do you have with scheduling and calendar management?",
                "How do you handle multiple tasks at once?",
            ]
            virtual_assistant_behavioral = [
                "Why are you interested in becoming a virtual assistant?",
                "How do you handle working independently?",
                "What makes you a good communicator?",
                "How do you stay organized when working remotely?",
            ]

            # Entry-level questions for customer service representative
            customer_service_technical = [
                "What experience do you have with customer service software?",
                "How do you handle customer complaints?",
                "What steps would you take to resolve a customer issue?",
                "How do you maintain customer records?",
            ]
            customer_service_behavioral = [
                "Why do you want to work in customer service?",
                "How do you handle difficult customers?",
                "What makes you a good listener?",
                "How do you stay calm under pressure?",
            ]

            # Entry-level questions for data entry specialist
            data_entry_technical = [
                "What experience do you have with data entry?",
                "How do you ensure accuracy in your work?",
                "What spreadsheet software are you familiar with?",
                "How do you handle repetitive tasks?",
            ]
            data_entry_behavioral = [
                "Why are you interested in data entry work?",
                "How do you maintain focus during detailed work?",
                "What makes you detail-oriented?",
                "How do you handle deadlines?",
            ]

            # Entry-level questions for construction on-site engineer
            construction_engineer_technical = [
                "What construction tools and equipment are you familiar with?",
                "How do you read and interpret construction plans?",
                "What safety protocols do you follow on construction sites?",
                "How do you handle construction site measurements and calculations?",
            ]
            construction_engineer_behavioral = [
                "Why are you interested in construction engineering?",
                "How do you handle working in different weather conditions?",
                "What makes you a good team player on construction sites?",
                "How do you ensure safety while working on-site?",
            ]

            # Entry-level questions for data scientist
            data_scientist_technical = [
                "What programming languages are you familiar with?",
                "How do you handle and clean data?",
                "What statistical concepts do you understand?",
                "What data visualization tools have you used?",
            ]
            data_scientist_behavioral = [
                "Why are you interested in data science?",
                "How do you approach solving data-related problems?",
                "What makes you a good analytical thinker?",
                "How do you communicate technical findings to non-technical people?",
            ]

            # Insert default questions
            questions_to_insert = []
            for position, stage, questions in [
                (
                    "virtual assistant",
                    "technical_questions",
                    virtual_assistant_technical,
                ),
                (
                    "virtual assistant",
                    "behavioral_questions",
                    virtual_assistant_behavioral,
                ),
                (
                    "customer service representative",
                    "technical_questions",
                    customer_service_technical,
                ),
                (
                    "customer service representative",
                    "behavioral_questions",
                    customer_service_behavioral,
                ),
                ("data entry specialist", "technical_questions", data_entry_technical),
                (
                    "data entry specialist",
                    "behavioral_questions",
                    data_entry_behavioral,
                ),
                (
                    "construction on-site engineer",
                    "technical_questions",
                    construction_engineer_technical,
                ),
                (
                    "construction on-site engineer",
                    "behavioral_questions",
                    construction_engineer_behavioral,
                ),
                ("data scientist", "technical_questions", data_scientist_technical),
                ("data scientist", "behavioral_questions", data_scientist_behavioral),
            ]:
                for question in questions:
                    questions_to_insert.append((position, stage, question))

            cursor.executemany(
                "INSERT INTO questions (position, stage, question) VALUES (?, ?, ?)",
                questions_to_insert,
            )

        conn.commit()
        conn.close()

    def get_candidate_by_email(self, email: str) -> Candidate:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT email, name, position, experience FROM candidates WHERE email = ?",
            (email,),
        )
        result = cursor.fetchone()

        conn.close()

        if result:
            return Candidate(
                email=result[0],
                name=result[1],
                position=result[2],
                experience=result[3],
            )
        return None

    def get_candidate_by_name(self, name: str) -> Candidate:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT email, name, position, experience FROM candidates WHERE name = ?",
            (name,),
        )
        result = cursor.fetchone()

        conn.close()

        if result:
            return Candidate(
                email=result[0],
                name=result[1],
                position=result[2],
                experience=result[3],
            )
        return None

    def create_candidate(
        self, email: str, name: str, position: str, experience: int
    ) -> Candidate:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        try:
            cursor.execute(
                "INSERT INTO candidates (email, name, position, experience) VALUES (?, ?, ?, ?)",
                (email, name, position, experience),
            )
            conn.commit()

            return Candidate(
                email=email, name=name, position=position, experience=experience
            )
        except sqlite3.IntegrityError:
            # If the candidate already exists, update their info
            cursor.execute(
                "UPDATE candidates SET name = ?, position = ?, experience = ? WHERE email = ?",
                (name, position, experience, email),
            )
            conn.commit()

            return Candidate(
                email=email, name=name, position=position, experience=experience
            )
        finally:
            conn.close()

    def get_questions_for_position_and_stage(
        self, position: str, stage: str
    ) -> List[str]:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT question FROM questions WHERE position = ? AND stage = ?",
            (position.lower(), stage),
        )
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
            CandidateDetails.Experience: "",
        }

        self._current_stage = InterviewStage.Introduction
        self._question_index = 0
        self._db = DatabaseDriver()

    def get_candidate_str(self):
        candidate_str = ""
        for key, value in self._candidate_details.items():
            candidate_str += f"{key.value}: {value}\n"

        return candidate_str

    def set_candidate_data(self, candidate_data):
        """Set the candidate data directly from the database result."""
        self._candidate_details = {
            CandidateDetails.Email: candidate_data.email,
            CandidateDetails.Name: candidate_data.name,
            CandidateDetails.Position: candidate_data.position,
            CandidateDetails.Experience: candidate_data.experience,
        }
        return f"Candidate data set: {self.get_candidate_str()}"

    @llm.ai_callable(description="get the details of the current candidate")
    def get_candidate_details(self):
        logger.info("get candidate details")
        return f"The candidate details are: {self.get_candidate_str()}"

    @llm.ai_callable(description="get the next interview question")
    def get_next_question(self):
        if not self.has_candidate():
            return "Please set candidate data first"

        position = self._candidate_details[CandidateDetails.Position].lower()

        # Default to software engineer if position not found
        if position not in ["software engineer", "data scientist", "product manager"]:
            position = "software engineer"

        if self._current_stage == InterviewStage.Introduction:
            self._current_stage = InterviewStage.TechnicalQuestions
            self._question_index = 0

            # Get questions for this position and stage from database
            questions = self._db.get_questions_for_position_and_stage(
                position, self._current_stage.value
            )
            if questions and self._question_index < len(questions):
                return questions[self._question_index]
            return "No technical questions available for this position."

        current_stage_questions = self._db.get_questions_for_position_and_stage(
            position, self._current_stage.value
        )

        if self._question_index < len(current_stage_questions) - 1:
            self._question_index += 1
            return current_stage_questions[self._question_index]
        elif self._current_stage == InterviewStage.TechnicalQuestions:
            self._current_stage = InterviewStage.BehavioralQuestions
            self._question_index = 0

            # Get questions for the new stage
            new_questions = self._db.get_questions_for_position_and_stage(
                position, self._current_stage.value
            )
            if new_questions and self._question_index < len(new_questions):
                return new_questions[self._question_index]
            return "No behavioral questions available for this position."
        elif self._current_stage == InterviewStage.BehavioralQuestions:
            self._current_stage = InterviewStage.Closing
            return "That concludes all our questions. Do you have any questions for us?"

        if self._current_stage == InterviewStage.Closing:
            return "The interview has concluded. Thank you for your time."

        return "No more questions available."

    def has_candidate(self):
        return self._candidate_details[CandidateDetails.Email] != ""
