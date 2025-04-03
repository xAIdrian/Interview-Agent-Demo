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


class InterviewError(Exception):
    """Custom exception for interview-related errors."""

    def __init__(
        self,
        message: str,
        code: str = None,
        details: str = None,
        status_code: int = 500,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details
        self.status_code = status_code


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
        try:
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

            # Insert sample data if tables are empty
            self._insert_sample_data(cursor)

            conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Database initialization error: {str(e)}")
            raise InterviewError(
                "Failed to initialize database",
                code="DB_INIT_ERROR",
                details=str(e),
                status_code=500,
            )
        finally:
            conn.close()

    def _insert_sample_data(self, cursor):
        try:
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
                    (
                        "mike.wilson@example.com",
                        "Mike Wilson",
                        "data entry specialist",
                        0,
                    ),
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
                self._insert_default_questions(cursor)
        except sqlite3.Error as e:
            logger.error(f"Error inserting sample data: {str(e)}")
            raise InterviewError(
                "Failed to insert sample data",
                code="SAMPLE_DATA_ERROR",
                details=str(e),
                status_code=500,
            )

    def _insert_default_questions(self, cursor):
        try:
            questions_to_insert = []
            for position, stage, questions in self._get_default_questions():
                for question in questions:
                    questions_to_insert.append((position, stage, question))

            cursor.executemany(
                "INSERT INTO questions (position, stage, question) VALUES (?, ?, ?)",
                questions_to_insert,
            )
        except sqlite3.Error as e:
            logger.error(f"Error inserting default questions: {str(e)}")
            raise InterviewError(
                "Failed to insert default questions",
                code="DEFAULT_QUESTIONS_ERROR",
                details=str(e),
                status_code=500,
            )

    def _get_default_questions(self):
        # Define default questions for different positions
        return [
            (
                "virtual assistant",
                "technical_questions",
                [
                    "What computer programs or tools are you familiar with?",
                    "How do you organize and manage your tasks?",
                    "What experience do you have with scheduling and calendar management?",
                    "How do you handle multiple tasks at once?",
                ],
            ),
            (
                "virtual assistant",
                "behavioral_questions",
                [
                    "Why are you interested in becoming a virtual assistant?",
                    "How do you handle working independently?",
                    "What makes you a good communicator?",
                    "How do you stay organized when working remotely?",
                ],
            ),
            # Add other positions' questions here...
        ]

    def get_candidate_by_email(self, email: str) -> Candidate:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute(
                "SELECT email, name, position, experience FROM candidates WHERE email = ?",
                (email,),
            )
            result = cursor.fetchone()

            if result:
                return Candidate(
                    email=result[0],
                    name=result[1],
                    position=result[2],
                    experience=result[3],
                )
            return None
        except sqlite3.Error as e:
            logger.error(f"Error fetching candidate by email: {str(e)}")
            raise InterviewError(
                "Failed to fetch candidate",
                code="CANDIDATE_FETCH_ERROR",
                details=str(e),
                status_code=500,
            )
        finally:
            conn.close()

    def get_candidate_by_name(self, name: str) -> Candidate:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute(
                "SELECT email, name, position, experience FROM candidates WHERE name = ?",
                (name,),
            )
            result = cursor.fetchone()

            if result:
                return Candidate(
                    email=result[0],
                    name=result[1],
                    position=result[2],
                    experience=result[3],
                )
            return None
        except sqlite3.Error as e:
            logger.error(f"Error fetching candidate by name: {str(e)}")
            raise InterviewError(
                "Failed to fetch candidate",
                code="CANDIDATE_FETCH_ERROR",
                details=str(e),
                status_code=500,
            )
        finally:
            conn.close()

    def create_candidate(
        self, email: str, name: str, position: str, experience: int
    ) -> Candidate:
        try:
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
        except sqlite3.Error as e:
            logger.error(f"Error creating/updating candidate: {str(e)}")
            raise InterviewError(
                "Failed to create/update candidate",
                code="CANDIDATE_CREATE_ERROR",
                details=str(e),
                status_code=500,
            )
        finally:
            conn.close()

    def get_questions_for_position_and_stage(
        self, position: str, stage: str
    ) -> List[str]:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute(
                "SELECT question FROM questions WHERE position = ? AND stage = ?",
                (position.lower(), stage),
            )
            results = cursor.fetchall()

            if results:
                return [result[0] for result in results]
            return []
        except sqlite3.Error as e:
            logger.error(f"Error fetching questions: {str(e)}")
            raise InterviewError(
                "Failed to fetch questions",
                code="QUESTIONS_FETCH_ERROR",
                details=str(e),
                status_code=500,
            )
        finally:
            conn.close()

    def add_interview_question(self, position: str, stage: str, question: str) -> str:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute(
                "INSERT INTO questions (position, stage, question) VALUES (?, ?, ?)",
                (position.lower(), stage, question),
            )
            conn.commit()

            return "Question added successfully"
        except sqlite3.Error as e:
            logger.error(f"Error adding question: {str(e)}")
            raise InterviewError(
                "Failed to add question",
                code="QUESTION_ADD_ERROR",
                details=str(e),
                status_code=500,
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
        try:
            self._candidate_details = {
                CandidateDetails.Email: candidate_data.email,
                CandidateDetails.Name: candidate_data.name,
                CandidateDetails.Position: candidate_data.position,
                CandidateDetails.Experience: candidate_data.experience,
            }
            return f"Candidate data set: {self.get_candidate_str()}"
        except Exception as e:
            logger.error(f"Error setting candidate data: {str(e)}")
            raise InterviewError(
                "Failed to set candidate data",
                code="CANDIDATE_DATA_ERROR",
                details=str(e),
                status_code=500,
            )

    @llm.ai_callable(description="get the details of the current candidate")
    def get_candidate_details(self):
        try:
            logger.info("get candidate details")
            return f"The candidate details are: {self.get_candidate_str()}"
        except Exception as e:
            logger.error(f"Error getting candidate details: {str(e)}")
            raise InterviewError(
                "Failed to get candidate details",
                code="CANDIDATE_DETAILS_ERROR",
                details=str(e),
                status_code=500,
            )

    @llm.ai_callable(description="get the next interview question")
    def get_next_question(self):
        try:
            if not self.has_candidate():
                return "Please set candidate data first"

            position = self._candidate_details[CandidateDetails.Position].lower()

            # Default to software engineer if position not found
            if position not in [
                "software engineer",
                "data scientist",
                "product manager",
            ]:
                position = "software engineer"

            if self._current_stage == InterviewStage.Introduction:
                self._current_stage = InterviewStage.TechnicalQuestions
                self._question_index = 0

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
        except Exception as e:
            logger.error(f"Error getting next question: {str(e)}")
            raise InterviewError(
                "Failed to get next question",
                code="NEXT_QUESTION_ERROR",
                details=str(e),
                status_code=500,
            )

    def has_candidate(self):
        return self._candidate_details[CandidateDetails.Email] != ""
