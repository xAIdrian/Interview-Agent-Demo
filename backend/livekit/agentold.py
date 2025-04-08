from __future__ import annotations

import logging
from dotenv import load_dotenv
import asyncio
import json
import time
import os
import random
from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins import openai
from livekit.agents import stt, transcription
from livekit.plugins.deepgram import STT
from prompts import agent_prompt_template
import requests

load_dotenv()
# Set up more verbose logging
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("livekit-agent-worker")
logger.setLevel(logging.DEBUG)  # Change to DEBUG for more verbose output

# Directory to save transcripts
TRANSCRIPT_DIR = os.path.join(os.path.dirname(__file__), "transcripts")
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

AUTH_HEADER = "Bearer dVCjV5QO8t"
CAMPAIGNS_API_URL = "http://127.0.0.1:5001/api/campaigns/{campaign_id}"
QUESTIONS_API_URL = "http://127.0.0.1:5001/api/questions?campaign_id={campaign_id}"

# Store transcript entries
transcript_entries = []

# List of female names to use for the AI interviewer
FEMALE_INTERVIEWER_NAMES = [
    "Emma",
    "Olivia",
    "Ava",
    "Isabella",
    "Sophia",
    "Charlotte",
    "Amelia",
    "Mia",
    "Harper",
    "Evelyn",
    "Abigail",
    "Emily",
    "Elizabeth",
    "Sofia",
    "Ella",
    "Madison",
    "Scarlett",
    "Victoria",
    "Aria",
    "Grace",
    "Chloe",
    "Camila",
    "Penelope",
    "Riley",
    "Layla",
    "Zoe",
    "Nora",
    "Lily",
    "Eleanor",
    "Hannah",
    "Lillian",
    "Addison",
    "Aubrey",
    "Ellie",
    "Stella",
    "Natalie",
    "Zoe",
    "Leah",
    "Hazel",
    "Violet",
    "Aurora",
    "Savannah",
    "Audrey",
    "Brooklyn",
    "Bella",
    "Claire",
    "Skylar",
    "Lucy",
    "Paisley",
    "Maya",
]


def generate_interviewer_name():
    """Generate a random female name for the AI interviewer"""
    return random.choice(FEMALE_INTERVIEWER_NAMES)


async def _forward_transcription(
    stt_stream: stt.SpeechStream,
    stt_forwarder: transcription.STTSegmentsForwarder,
    speaker_name: str,
):
    """Forward the transcription and log the transcript in the console with emoji"""
    global transcript_entries

    async for ev in stt_stream:
        stt_forwarder.update(ev)
        if ev.type == stt.SpeechEventType.INTERIM_TRANSCRIPT:
            print(f"{speaker_name}: {ev.alternatives[0].text}", end="")
        elif ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
            transcript_text = ev.alternatives[0].text
            print("\n")
            # Add emoji based on speaker
            emoji = "👤" if speaker_name == "Candidate" else "🤖"
            print(f"{emoji} {speaker_name} -> {transcript_text}")
            logger.info(f"{emoji} {speaker_name}: {transcript_text}")

            # Add to transcript list
            entry = {
                "speaker": speaker_name,
                "text": transcript_text,
                "timestamp": time.time(),
            }
            transcript_entries.append(entry)
            logger.debug(
                f"Added transcript entry for {speaker_name}: {len(transcript_entries)} entries total"
            )


async def entrypoint(ctx: JobContext):
    global transcript_entries
    # Reset transcript entries at the start of each session
    transcript_entries = []
    logger.info("🧹 Cleared previous transcript entries")

    # Generate a random interviewer name
    interviewer_name = generate_interviewer_name()
    logger.info(f"👩 Using interviewer name: {interviewer_name}")

    stt_service = STT()
    tasks = []

    logger.info("🚀 Initializing interview agent")

    async def transcribe_track(participant: rtc.RemoteParticipant, track: rtc.Track):
        try:
            logger.info(f"🎤 Setting up transcription for {participant.identity}")
            audio_stream = rtc.AudioStream(track)
            stt_forwarder = transcription.STTSegmentsForwarder(
                room=ctx.room, participant=participant, track=track
            )
            stt_stream = stt_service.stream()
            stt_task = asyncio.create_task(
                _forward_transcription(stt_stream, stt_forwarder, "Candidate")
            )
            tasks.append(stt_task)

            logger.info(f"✅ Started transcribing for {participant.identity}")

            async for segment in audio_stream:
                stt_stream.push_frame(segment.frame)

        except Exception as e:
            logger.error(f"❌ Error in transcribe_track: {e}")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        logger.info(f"🔊 Track subscribed: {track.kind} from {participant.identity}")
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"🎧 Audio track detected, setting up transcription")
            tasks.append(asyncio.create_task(transcribe_track(participant, track)))

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        logger.info(f"👋 Participant {participant.identity} disconnected")
        # Save transcript when participant disconnects
        save_transcript()

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f"🎉 Participant {participant.identity} connected")

    logger.info(f"🔗 Connecting to room {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"✅ Connected to room {ctx.room.name}")

    # Wait for a participant to join
    logger.info("⏳ Waiting for participant...")
    participant = await ctx.wait_for_participant()
    logger.info(f"🎉 Participant {participant.identity} joined")

    # Extract submission ID from participant identity
    try:
        submission_id = participant.identity.split("_")[0]
        logger.info(f"🆔 Extracted submission ID: {submission_id}")

        # Fetch submission details (including resume_text and campaign details)
        submission_data = await fetch_submission_data(submission_id)

        campaign_id = submission_data["submission"].get("campaign_id")

        # Fetch questions from API
        try:
            logger.info(f"📝 Fetching questions for submission: {submission_id}")
            response = requests.get(QUESTIONS_API_URL.format(campaign_id=campaign_id))
            response.raise_for_status()
            questions = response.json()
            logger.info(f"✅ Retrieved {len(questions)} questions")
            question_titles = [question["title"] for question in questions]
        except requests.RequestException as e:
            logger.error(f"❌ Error fetching questions: {e}")
            # Fallback questions in case API fails
            question_titles = ["Tell me about yourself", "What are your strengths?"]
    except Exception as e:
        logger.error(f"❌ Error processing participant identity: {e}")
        # Don't continue with fallback data, raise the error to stop execution
        logger.critical(
            "Cannot proceed without valid participant identity and submission data"
        )
        raise ValueError(f"Failed to process participant identity: {e}")

    # Start the multimodal agent with the questions
    try:
        agent = run_multimodal_agent(
            ctx, participant, question_titles, submission_data, interviewer_name
        )
        logger.info("✅ Agent started successfully")

        # Add an initial AI message to the transcript
        initial_message = {
            "speaker": "AI",
            "text": f"Hello! I'm {interviewer_name}, an AI interviewer. I'll be asking you a few questions today. Let's get started!",
            "timestamp": time.time(),
        }
        transcript_entries.append(initial_message)
        logger.info(f"🤖 Added initial AI greeting to transcript")

        # Send initial greeting to the frontend
        await send_message_to_participants(ctx.room, initial_message)

    except Exception as e:
        logger.error(f"❌ Error starting multimodal agent: {e}")

    # Keep the agent running
    try:
        # Wait for all tasks to complete or until disconnected
        await asyncio.gather(*tasks, return_exceptions=True)
    except asyncio.CancelledError:
        logger.info("🛑 Agent tasks cancelled")
    except Exception as e:
        logger.error(f"❌ Error in main agent loop: {e}")
    finally:
        # Make sure to save transcript on exit
        save_transcript()

    logger.info("✅ Agent entrypoint completed")


async def send_message_to_participants(room, message):
    """Send a message to all participants in the room via data channel"""
    try:
        # Convert message to JSON
        message_json = json.dumps(
            {
                "type": "transcript",
                "speaker": message["speaker"],
                "text": message["text"],
            }
        )

        # Send to all participants
        room.local_participant.publish_data(message_json.encode(), reliable=True)
        logger.debug(f"✉️ Sent message to participants: {message['text'][:50]}...")
    except Exception as e:
        logger.error(f"❌ Error sending message to participants: {e}")


def save_transcript():
    """Save the complete transcript to a file"""
    global transcript_entries

    logger.info("📝 ========== COMPLETE INTERVIEW TRANSCRIPT ==========")
    try:
        if not transcript_entries:
            logger.warning("⚠️ Transcript is empty! No conversations were recorded.")
            return

        # Save to file with timestamp
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        filename = os.path.join(
            TRANSCRIPT_DIR, f"interview_transcript_{timestamp}.json"
        )

        with open(filename, "w") as f:
            json.dump(transcript_entries, f, indent=2)
        logger.info(f"💾 Transcript saved to {filename}")

        # Print to console
        for entry in transcript_entries:
            emoji = "👤" if entry["speaker"] == "Candidate" else "🤖"
            logger.info(f"{emoji} [{entry['speaker']}]: {entry['text']}")

        # Check transcript size
        logger.info(f"📊 Total transcript entries: {len(transcript_entries)}")

    except Exception as e:
        logger.error(f"❌ Error saving transcript: {e}")
    finally:
        logger.info("📝 ===============================================")


def run_multimodal_agent(
    ctx: JobContext,
    participant: rtc.RemoteParticipant,
    questions,
    submission_data,
    interviewer_name,
):
    global transcript_entries
    logger.info(f"🤖 Starting multimodal agent with {len(questions)} questions")

    try:
        full_prompt = agent_prompt_template.format(
            interviewer_name=interviewer_name,
            questions="\n".join([f"- {q}" for q in questions]),
            job_description=submission_data["job_description"],
            resume_text=submission_data["resume_text"],
            campaign_context=submission_data.get("campaign_context", ""),
        )

        # Log the full prompt for debugging
        logger.debug(f"Full agent prompt: {full_prompt}")

        model = openai.realtime.RealtimeModel(
            instructions=full_prompt,
            modalities=["audio", "text"],
        )
        logger.debug("✅ Realtime model created")

        # create a chat context with chat history
        chat_ctx = llm.ChatContext()

        # Add initial context for the AI
        initial_context = (
            f"You are {interviewer_name}, an AI interviewer conducting a job interview. "
            f"The candidate has applied for a position and submitted their resume. "
            f"Resume text: {submission_data['resume_text']}\n"
            f"Job description: {submission_data['job_description']}\n"
            f"Use this information to provide a personalized interview experience."
        )

        chat_ctx.append(
            text=initial_context,
            role="assistant",
        )
        logger.debug("✅ Chat context initialized")

        # Create the multimodal agent
        agent = MultimodalAgent(
            model=model,
            chat_ctx=chat_ctx,
        )

        # Define callback for message generation
        def on_message_generated(message):
            """Callback for when the agent generates a message"""
            try:
                msg_text = message.text if hasattr(message, "text") else str(message)
                logger.info(f"🤖 AI generated message: {msg_text}")

                # Add to transcript
                entry = {"speaker": "AI", "text": msg_text, "timestamp": time.time()}
                transcript_entries.append(entry)
                logger.debug(
                    f"Added AI response to transcript. Total entries: {len(transcript_entries)}"
                )

                # Send the message to participants via data channel
                asyncio.create_task(send_message_to_participants(ctx.room, entry))
            except Exception as e:
                logger.error(f"❌ Error in on_message_generated: {e}")

        # Monkey patch methods to ensure we capture all outputs
        original_send_text = agent.send_text if hasattr(agent, "send_text") else None
        if original_send_text:

            def patched_send_text(text, *args, **kwargs):
                try:
                    logger.debug(f"🤖 Agent sending text: {text}")
                    entry = {"speaker": "AI", "text": text, "timestamp": time.time()}
                    transcript_entries.append(entry)
                    logger.debug(
                        f"Added AI text to transcript via send_text. Total entries: {len(transcript_entries)}"
                    )

                    # Send the message to participants
                    asyncio.create_task(send_message_to_participants(ctx.room, entry))
                except Exception as e:
                    logger.error(f"❌ Error in patched_send_text: {e}")
                return original_send_text(text, *args, **kwargs)

            agent.send_text = patched_send_text
            logger.debug("✅ Patched send_text method")

        # Set the callback (different ways depending on API version)
        logger.debug("⚙️ Setting up message callback")
        if hasattr(agent, "on_message_generated"):
            agent.on_message_generated = on_message_generated
            logger.debug("✅ Set callback using on_message_generated attribute")
        elif hasattr(agent, "set_on_message_generated"):
            agent.set_on_message_generated(on_message_generated)
            logger.debug("✅ Set callback using set_on_message_generated method")
        elif hasattr(model, "on_response"):
            model.on_response = on_message_generated
            logger.debug("✅ Set callback using model.on_response")
        else:
            logger.warning(
                "⚠️ Could not set message generation callback - manually patching methods"
            )

            # Monkey patch the agent's internal methods if needed
            original_generate = agent.generate_reply

            def patched_generate(*args, **kwargs):
                logger.info("🤖 Agent generating a reply (patched method)")
                result = original_generate(*args, **kwargs)
                logger.info("🤖 Agent generated a reply (patched method complete)")

                # Try to capture the response
                try:
                    if (
                        hasattr(agent, "_last_generated_message")
                        and agent._last_generated_message
                    ):
                        msg_text = agent._last_generated_message
                        entry = {
                            "speaker": "AI",
                            "text": msg_text,
                            "timestamp": time.time(),
                        }
                        transcript_entries.append(entry)
                        logger.debug(
                            f"Added AI response via patched generate. Total entries: {len(transcript_entries)}"
                        )

                        # Send to frontend
                        asyncio.create_task(
                            send_message_to_participants(ctx.room, entry)
                        )
                except Exception as e:
                    logger.error(
                        f"❌ Error capturing response in patched_generate: {e}"
                    )

                return result

            agent.generate_reply = patched_generate
            logger.debug("✅ Patched generate_reply method")

        # Start the agent
        logger.info(f"🚀 Starting agent for participant {participant.identity}")
        agent.start(ctx.room, participant)
        logger.info("✅ Agent started")

        # Make the agent speak first
        logger.info("💬 Generating initial reply from agent")
        agent.generate_reply()
        logger.info("✅ Initial reply generated")

        return agent

    except Exception as e:
        logger.error(f"❌ Error in run_multimodal_agent: {e}", exc_info=True)
        raise


async def fetch_submission_data(submission_id):
    """Fetch submission data including resume text and campaign details"""
    try:
        logger.info(f"📄 Fetching submission data for ID: {submission_id}")
        submission_url = f"http://127.0.0.1:5001/api/submissions/{submission_id}"
        response = requests.get(submission_url)
        response.raise_for_status()

        submission_data = response.json()

        # Get campaign details
        campaign_id = submission_data.get("campaign_id")
        if campaign_id:
            campaign_url = f"http://127.0.0.1:5001/api/campaigns/{campaign_id}"
            campaign_response = requests.get(campaign_url)
            campaign_response.raise_for_status()
            campaign_data = campaign_response.json()

            # Add campaign details to the submission data
            submission_data["job_description"] = campaign_data.get("job_description")
            submission_data["campaign_context"] = campaign_data.get(
                "campaign_context", ""
            )

            if not submission_data["job_description"]:
                raise ValueError("Missing job description in campaign data")

            logger.info(f"✅ Retrieved campaign details for campaign ID: {campaign_id}")
        else:
            raise ValueError("No campaign ID found in submission data")

        # Use provided resume text or raise error
        if not submission_data.get("resume_text"):
            raise ValueError("No resume text found in submission")

        return submission_data

    except Exception as e:
        logger.error(f"❌ Error fetching submission data: {e}")
        raise  # Re-raise the exception to stop execution


if __name__ == "__main__":
    try:
        logger.info("🚀 Starting LiveKit agent application")
        cli.run_app(
            WorkerOptions(
                entrypoint_fnc=entrypoint,
            )
        )
    except Exception as e:
        logger.error(f"❌ Error running agent application: {e}", exc_info=True)
