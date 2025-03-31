from __future__ import annotations
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins import openai
from dotenv import load_dotenv
from interview_api import AssistantFnc, DatabaseDriver
from prompts import WELCOME_MESSAGE, demo_agent_prompt_template
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

        # Initialize the assistant with candidate data
        assistant_fnc = AssistantFnc()
        assistant_fnc.set_candidate_data(candidate_data)
        print("\n✅ Assistant initialized with candidate data")

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
        # session.conversation.item.create(
        #     llm.ChatMessage(role="assistant", content=WELCOME_MESSAGE)
        # )
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

    print("\n" + "=" * 50)
    print("🏁 Interview Session Ready")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
