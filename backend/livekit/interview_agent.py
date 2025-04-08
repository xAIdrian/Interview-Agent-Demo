from __future__ import annotations
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins import openai
from dotenv import load_dotenv
import sys
import os
from interview_api import AssistantFnc

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db_connection, map_row_to_dict
from prompts import WELCOME_MESSAGE, demo_agent_prompt_template
import logging

# Load environment variables
load_dotenv()

# Configure production logging
# LOG_DIR = "/home/ec2-user/backend/logs"
# os.makedirs(LOG_DIR, exist_ok=True)

# Configure logging with file handler
logger = logging.getLogger("interview-agent")
logger.setLevel(logging.INFO)


async def entrypoint(ctx: JobContext):
    print("\n" + "=" * 50)
    print("🚀 Starting Interview Session")
    print("=" * 50 + "\n")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    participant = await ctx.wait_for_participant()
    print(f"\n👤 Participant joined: {participant}")

    # Use the identity directly as the campaign ID
    campaign_id = participant.identity
    print(f"📋 Campaign ID: {campaign_id}")

    # Fetch campaign data from database
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get campaign details
        cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
        campaign = cursor.fetchone()

        if not campaign:
            print(f"❌ No campaign found for ID: {campaign_id}")
            raise ValueError(f"Campaign not found for ID: {campaign_id}")

        # Get campaign columns
        cursor.execute("PRAGMA table_info(campaigns)")
        columns = [row[1] for row in cursor.fetchall()]
        campaign_data = map_row_to_dict(campaign, columns)

        # Get questions for this campaign
        cursor.execute("SELECT * FROM questions WHERE campaign_id = ?", (campaign_id,))
        questions = cursor.fetchall()

        if questions:
            cursor.execute("PRAGMA table_info(questions)")
            question_columns = [row[1] for row in cursor.fetchall()]
            campaign_data["questions"] = [
                map_row_to_dict(q, question_columns) for q in questions
            ]
        else:
            campaign_data["questions"] = []

        print(f"\n✅ Campaign data:")
        print(f"  Title: {campaign_data['title']}")
        print(f"  Description: {campaign_data['job_description']}")
        print(f"  Context: {campaign_data['campaign_context']}")
        print(f"\n📚 Questions loaded: {len(campaign_data['questions'])} questions")

        # Format questions for the prompt
        questions_prompt = "\nInterview Questions:\n"
        for i, q in enumerate(campaign_data["questions"], 1):
            questions_prompt += f"{i}. {q['title']}\n{q['body']}\n"

        # Initialize the assistant with campaign data
        assistant_fnc = AssistantFnc()
        assistant_fnc.set_campaign_data(campaign_data)
        print("\n✅ Assistant initialized with campaign data")

        # Initialize the model and agent with custom instructions
        model = openai.realtime.RealtimeModel(
            instructions=demo_agent_prompt_template,
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
    finally:
        conn.close()

    print("\n" + "=" * 50)
    print("🏁 Interview Session Ready")
    print("=" * 50 + "\n")


def enter_app():
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    enter_app()
