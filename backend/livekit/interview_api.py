from livekit.agents import llm, JobContext
import enum
from typing import List
import logging
from dataclasses import dataclass
from database import get_db_connection, map_row_to_dict

logger = logging.getLogger("interview-api")
logger.setLevel(logging.INFO)


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
class Question:
    id: str
    title: str
    body: str
    scoring_prompt: str
    max_points: int
    order_index: int = 0


@dataclass
class Campaign:
    id: str
    title: str
    max_user_submissions: int
    max_points: int
    is_public: bool
    campaign_context: str
    job_description: str
    questions: List[Question]


class InterviewStage(enum.Enum):
    Introduction = "introduction"
    Questions = "questions"
    Closing = "closing"


class AssistantFnc(JobContext):
    def __init__(self):
        super().__init__()
        self._campaign_data = None
        self._current_stage = InterviewStage.Introduction
        self._question_index = 0

    def get_campaign_str(self):
        if not self._campaign_data:
            return "No campaign data set"

        return f"""
Title: {self._campaign_data.title}
Job Description: {self._campaign_data.job_description}
Context: {self._campaign_data.campaign_context}
Max Points: {self._campaign_data.max_points}
        """.strip()

    def set_campaign_data(self, campaign_data: dict):
        """Set the campaign data for the interview."""
        try:
            # Convert questions from dict to Question objects
            questions = []
            if "questions" in campaign_data:
                for q in campaign_data["questions"]:
                    question = Question(
                        id=str(q["id"]),
                        title=q["title"],
                        body=q["body"],
                        scoring_prompt=q["scoring_prompt"],
                        max_points=q["max_points"],
                        order_index=q.get("order_index", 0),
                    )
                    questions.append(question)

            # Create Campaign object
            self._campaign_data = Campaign(
                id=str(campaign_data["id"]),
                title=campaign_data["title"],
                max_user_submissions=campaign_data["max_user_submissions"],
                max_points=campaign_data["max_points"],
                is_public=campaign_data["is_public"],
                campaign_context=campaign_data["campaign_context"],
                job_description=campaign_data["job_description"],
                questions=questions,
            )

            logger.info(
                f"Successfully set campaign data for campaign: {self._campaign_data.title}"
            )
            return f"Campaign data set:\n{self.get_campaign_str()}"
        except KeyError as e:
            logger.error(f"Missing required field in campaign data: {str(e)}")
            raise InterviewError(
                "Failed to set campaign data: missing required field",
                code="CAMPAIGN_DATA_ERROR",
                details=f"Missing field: {str(e)}",
                status_code=400,
            )
        except Exception as e:
            logger.error(f"Error setting campaign data: {str(e)}")
            raise InterviewError(
                "Failed to set campaign data",
                code="CAMPAIGN_DATA_ERROR",
                details=str(e),
                status_code=500,
            )

    def get_campaign_details(self):
        """Get the details of the current campaign"""
        try:
            logger.info("get campaign details")
            return f"The campaign details are:\n{self.get_campaign_str()}"
        except Exception as e:
            logger.error(f"Error getting campaign details: {str(e)}")
            raise InterviewError(
                "Failed to get campaign details",
                code="CAMPAIGN_DETAILS_ERROR",
                details=str(e),
                status_code=500,
            )

    def get_next_question(self):
        """Get the next interview question"""
        try:
            if not self._campaign_data:
                return "Please set campaign data first"

            if self._current_stage == InterviewStage.Introduction:
                self._current_stage = InterviewStage.Questions
                self._question_index = 0

                if self._campaign_data.questions:
                    question = self._campaign_data.questions[0]
                    return f"{question.title}\n{question.body}"
                return "No questions available for this campaign."

            if self._current_stage == InterviewStage.Questions:
                if self._question_index < len(self._campaign_data.questions) - 1:
                    self._question_index += 1
                    question = self._campaign_data.questions[self._question_index]
                    return f"{question.title}\n{question.body}"
                else:
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

    def has_campaign(self):
        return self._campaign_data is not None
