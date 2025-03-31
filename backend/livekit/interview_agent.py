from __future__ import annotations
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins import openai
from dotenv import load_dotenv
from interview_api import AssistantFnc, DatabaseDriver
from prompts import WELCOME_MESSAGE, AGENT_INSTRUCTIONS, LOOKUP_EMAIL_MESSAGE
import os
import logging

logger = logging.getLogger("interview-agent")
logger.setLevel(logging.INFO)

load_dotenv()


async def entrypoint(ctx: JobContext):
    print("\n" + "=" * 50)
    print("🚀 Starting Interview Session")
    print("=" * 50 + "\n")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    participant = await ctx.wait_for_participant()
    print(f"\n👤 Participant joined: {participant.identity}")

    # Extract name from participant identity
    name = participant.identity
    print(f"👤 Candidate name: {name}")

    # Fetch candidate data from database
    try:
        db = DatabaseDriver()
        candidate_data = db.get_candidate_by_name(name)
        if not candidate_data:
            print(f"❌ No candidate found for name: {name}")
            raise ValueError(f"Candidate not found for name: {name}")

        print(f"\n✅ Candidate data:")
        print(f"  Name: {candidate_data.name}")
        print(f"  Email: {candidate_data.email}")
        print(f"  Position: {candidate_data.position}")
        print(f"  Experience: {candidate_data.experience}")

        # Get questions for the candidate's position
        technical_questions = db.get_questions_for_position_and_stage(
            candidate_data.position, "technical_questions"
        )
        behavioral_questions = db.get_questions_for_position_and_stage(
            candidate_data.position, "behavioral_questions"
        )

        print(f"\n📚 Questions loaded:")
        print(f"  Technical: {len(technical_questions)} questions")
        print(f"  Behavioral: {len(behavioral_questions)} questions")

        # Format questions for the prompt
        questions_prompt = "\nTechnical Questions:\n"
        for i, q in enumerate(technical_questions, 1):
            questions_prompt += f"{i}. {q}\n"

        questions_prompt += "\nBehavioral Questions:\n"
        for i, q in enumerate(behavioral_questions, 1):
            questions_prompt += f"{i}. {q}\n"

        # Create custom instructions with the questions
        custom_instructions = f"""
{AGENT_INSTRUCTIONS}

You are conducting an interview for a {candidate_data.position} position.
The candidate's name is {candidate_data.name} and they have {candidate_data.experience} years of experience.

Here are the specific questions you should ask in order:

{questions_prompt}

Follow these guidelines:
1. Ask questions in the exact order provided
2. After each answer, move to the next question
3. Keep track of which question you're on
4. Maintain a professional and friendly tone
5. Listen carefully to the candidate's responses
6. If a response is unclear, ask for clarification
7. After all questions are asked, thank the candidate and conclude the interview
"""

        # Initialize the assistant with candidate data
        assistant_fnc = AssistantFnc()
        assistant_fnc.lookup_candidate(
            candidate_data.email
        )  # Still need email for the assistant
        print("\n✅ Assistant initialized with candidate data")

        # Initialize the model and agent with custom instructions
        model = openai.realtime.RealtimeModel(
            instructions=custom_instructions,
            voice="shimmer",
            temperature=0.8,
            modalities=["audio", "text"],
        )
        assistant = MultimodalAgent(model=model, fnc_ctx=assistant_fnc)
        assistant.start(ctx.room)
        print("✅ Multimodal agent started")

        session = model.sessions[0]
        session.conversation.item.create(
            llm.ChatMessage(role="assistant", content=WELCOME_MESSAGE)
        )
        session.response.create()
        print("✅ Initial session created")

        @session.on("user_speech_committed")
        def on_user_speech_committed(msg: llm.ChatMessage):
            if isinstance(msg.content, list):
                msg.content = "\n".join(
                    "[image]" if isinstance(x, llm.ChatImage) else x for x in msg
                )

            if assistant_fnc.has_candidate():
                handle_interview(msg)
            else:
                find_candidate(msg)

        def find_candidate(msg: llm.ChatMessage):
            print("\n🔍 Looking up candidate...")
            session.conversation.item.create(
                llm.ChatMessage(role="system", content=LOOKUP_EMAIL_MESSAGE(msg))
            )
            session.response.create()

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

    print("\n" + "=" * 50)
    print("🏁 Interview Session Ready")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
