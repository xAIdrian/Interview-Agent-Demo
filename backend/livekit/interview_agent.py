from __future__ import annotations
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins import openai
from dotenv import load_dotenv
import sys
import os
import requests
import json
from typing import Dict, Any

# API_BASE_URL = "https://main-service-48k0.onrender.com"
API_BASE_URL = "http://127.0.0.1:5001"

# Add the backend directory to the Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from database import get_db_connection, map_row_to_dict
from interview_api import AssistantFnc
from prompts import INTERVIEW_PROMPT_TEMPLATE, INTERVIEW_PROMPT_TEMPLATE_EN
import logging

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger("interview-agent")
logger.setLevel(logging.INFO)


async def entrypoint(ctx: JobContext):
    print("\n" + "=" * 50)
    print(" Starting interview agent...")
    print("=" * 50 + "\n")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    participant = await ctx.wait_for_participant()
    print(f"\n👤 Participant joined: {participant}")

    # Extract language from token metadata
    language = "en"  # Default to English
    if participant.metadata:
        try:
            metadata = json.loads(participant.metadata)
            language = metadata.get("language", "en")
        except json.JSONDecodeError:
            logger.warning(
                "Failed to parse participant metadata, using default language"
            )

    print(f"🌍 Interview language: {language}")

    # Use the identity directly as the campaign ID
    campaign_id = participant.identity
    print(f"📋 Campaign ID: {campaign_id}")

    # Fetch campaign data from database
    try:
        # conn = get_db_connection()
        # cursor = conn.cursor()

        # Get campaign details
        campaign_url = f"{API_BASE_URL}/api/campaigns/{campaign_id}"
        campaign_response = requests.get(campaign_url)

        if not campaign_response.ok:
            print(f"❌ Failed to fetch campaign: {campaign_response.status_code}")
            raise ValueError(f"Failed to fetch campaign: {campaign_response.text}")

        campaign_data = campaign_response.json()
        print("🚀 ~ campaign_data:", campaign_data)
        if not campaign_data:
            print(f"❌ No campaign found for ID: {campaign_id}")
            raise ValueError(f"Campaign not found for ID: {campaign_id}")

        # Get campaign questions
        questions_url = f"{API_BASE_URL}/interview/campaigns/{campaign_id}/questions"
        questions_response = requests.get(questions_url)
        if questions_response.status_code != 200:
            logger.error(f"Failed to fetch questions: {questions_response.text}")
            return None

        campaign_data["questions"] = questions_response.json()

        print(f"\n✅ Campaign data:")
        print(f"  Title: {campaign_data['title']}")
        print(f"  Description: {campaign_data['job_description']}")
        print(f"  Context: {campaign_data['campaign_context']}")
        print(f"\n📚 Questions loaded: {len(campaign_data['questions'])} questions")

        # Format questions for the prompt
        questions_prompt = "\n".join(
            [
                f"{i+1}. {q['title']}\n{q['body']}\n"
                for i, q in enumerate(campaign_data["questions"])
            ]
        )

        # Select prompt template based on language
        prompt_template = (
            INTERVIEW_PROMPT_TEMPLATE
            if language == "fr"
            else INTERVIEW_PROMPT_TEMPLATE_EN
        )

        # Create the interview prompt
        interview_prompt = prompt_template.format(
            job_description=campaign_data["job_description"], questions=questions_prompt
        )

        # Initialize the assistant with campaign data
        assistant_fnc = AssistantFnc()
        assistant_fnc.set_campaign_data(campaign_data)
        print("\n✅ Assistant initialized with campaign data")

        # Initialize the model and agent with custom instructions
        model = openai.realtime.RealtimeModel(
            instructions=interview_prompt,
            voice="shimmer",
            temperature=0.8,
            modalities=["audio", "text"],
        )
        assistant = MultimodalAgent(model=model, fnc_ctx=assistant_fnc)
        assistant.start(ctx.room)
        print("✅ Multimodal agent started")

        session = model.sessions[0]
        session.response.create()
        print("✅ Initial session created")

        # Generate initial reply to start the conversation
        print("\n🎤 Agent starting conversation...")
        assistant.generate_reply()
        print("✅ Initial reply generated")

        @session.on("user_speech_committed")
        def on_user_speech_committed(msg: llm.ChatMessage):
            if isinstance(msg.content, list):
                msg.content = "\n".join(
                    "[image]" if isinstance(x, llm.ChatImage) else x for x in msg
                )
            handle_interview(msg)

        def handle_interview(msg: llm.ChatMessage):
            print("\n🗣️ Processing interview response...")
            session.conversation.item.create(
                llm.ChatMessage(role="user", content=msg.content)
            )

            # After getting user's response, ask the next question
            response = session.response.create()

            @response.on("done")
            def ask_next_question():
                next_question = assistant_fnc.get_next_question()
                if next_question:
                    print("\n📝 Asking next question...")
                    session.conversation.item.create(
                        llm.ChatMessage(role="assistant", content=next_question)
                    )
                    session.response.create()

    except Exception as e:
        print(f"❌ Error in interview setup: {e}")
        raise
    # finally:
    # conn.close()

    print("\n" + "=" * 50)
    print("🏁 Interview Session Ready")
    print("=" * 50 + "\n")


def enter_app():
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    enter_app()
