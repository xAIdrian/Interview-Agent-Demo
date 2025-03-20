from __future__ import annotations

import logging
from dotenv import load_dotenv
import asyncio
import json
import time
import os
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
from prompts import agent_prompt_template, sample_resume, sample_job_description
import requests

load_dotenv()
# Set up more verbose logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("livekit-agent-worker")
logger.setLevel(logging.DEBUG)  # Change to DEBUG for more verbose output

# Directory to save transcripts
TRANSCRIPT_DIR = os.path.join(os.path.dirname(__file__), "transcripts")
os.makedirs(TRANSCRIPT_DIR, exist_ok=True)

AUTH_HEADER = "Bearer dVCjV5QO8t"
CAMPAIGNS_API_URL = "http://localhost:5000/api/campaigns/{campaign_id}"
QUESTIONS_API_URL = "http://localhost:5000/api/questions?campaign_id={campaign_id}"

# Store transcript entries
transcript_entries = []

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
                "timestamp": time.time()
            }
            transcript_entries.append(entry)
            logger.debug(f"Added transcript entry for {speaker_name}: {len(transcript_entries)} entries total")


async def entrypoint(ctx: JobContext):
    global transcript_entries
    # Reset transcript entries at the start of each session
    transcript_entries = []
    logger.info("🧹 Cleared previous transcript entries")
    
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
    
    # Extract campaign ID from participant identity
    try:
        campaign_id_from_participant_identity = participant.identity.split('_')[0]
        logger.info(f"🆔 Extracted campaign ID: {campaign_id_from_participant_identity}")
        
        # Fetch questions from API
        try:
            logger.info(f"📝 Fetching questions for campaign: {campaign_id_from_participant_identity}")
            response = requests.get(
                QUESTIONS_API_URL.format(campaign_id=campaign_id_from_participant_identity),
                headers={"Authorization": AUTH_HEADER}
            )
            response.raise_for_status()
            questions = response.json()
            logger.info(f"✅ Retrieved {len(questions)} questions")
            question_titles = [question['title'] for question in questions]
        except requests.RequestException as e:
            logger.error(f"❌ Error fetching questions: {e}")
            # Fallback questions in case API fails
            question_titles = ["Tell me about yourself", "What are your strengths?"]
    except Exception as e:
        logger.error(f"❌ Error processing participant identity: {e}")
        # Fallback questions
        question_titles = ["Tell me about yourself", "What are your strengths?"]

    # Start the multimodal agent with the questions
    try:
        agent = run_multimodal_agent(ctx, participant, question_titles)
        logger.info("✅ Agent started successfully")
        
        # Add an initial AI message to the transcript
        initial_message = {
            "speaker": "AI",
            "text": "Hello! I'm Gulpin, an AI interviewer. I'll be asking you a few questions today. Let's get started!",
            "timestamp": time.time()
        }
        transcript_entries.append(initial_message)
        logger.info(f"🤖 Added initial AI greeting to transcript")
        
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
        filename = os.path.join(TRANSCRIPT_DIR, f"interview_transcript_{timestamp}.json")
        
        with open(filename, "w") as f:
            json.dump(transcript_entries, f, indent=2)
        logger.info(f"💾 Transcript saved to {filename}")
        
        # Print to console
        for entry in transcript_entries:
            emoji = "👤" if entry['speaker'] == "Candidate" else "🤖"
            logger.info(f"{emoji} [{entry['speaker']}]: {entry['text']}")
            
        # Check transcript size
        logger.info(f"📊 Total transcript entries: {len(transcript_entries)}")
        
    except Exception as e:
        logger.error(f"❌ Error saving transcript: {e}")
    finally:
        logger.info("📝 ===============================================")


def run_multimodal_agent(ctx: JobContext, participant: rtc.RemoteParticipant, questions):
    global transcript_entries
    logger.info(f"🤖 Starting multimodal agent with {len(questions)} questions")

    try:
        model = openai.realtime.RealtimeModel(
            instructions=(agent_prompt_template.format(
                questions="\n".join(questions),
                job_description=sample_job_description
            )),
            modalities=["audio", "text"],
        )
        logger.debug("✅ Realtime model created")

        # create a chat context with chat history
        chat_ctx = llm.ChatContext()
        chat_ctx.append(
            text=f"Context about the user: {sample_resume}",
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
                msg_text = message.text if hasattr(message, 'text') else str(message)
                logger.info(f"🤖 AI generated message: {msg_text}")
                
                # Add to transcript
                entry = {
                    "speaker": "AI",
                    "text": msg_text,
                    "timestamp": time.time()
                }
                transcript_entries.append(entry)
                logger.debug(f"Added AI response to transcript. Total entries: {len(transcript_entries)}")
            except Exception as e:
                logger.error(f"❌ Error in on_message_generated: {e}")
        
        # Monkey patch methods to ensure we capture all outputs
        original_send_text = agent.send_text if hasattr(agent, "send_text") else None
        if original_send_text:
            def patched_send_text(text, *args, **kwargs):
                try:
                    logger.debug(f"🤖 Agent sending text: {text}")
                    entry = {
                        "speaker": "AI",
                        "text": text,
                        "timestamp": time.time()
                    }
                    transcript_entries.append(entry)
                    logger.debug(f"Added AI text to transcript via send_text. Total entries: {len(transcript_entries)}")
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
            logger.warning("⚠️ Could not set message generation callback - manually patching methods")
            
            # Monkey patch the agent's internal methods if needed
            original_generate = agent.generate_reply
            def patched_generate(*args, **kwargs):
                logger.info("🤖 Agent generating a reply (patched method)")
                result = original_generate(*args, **kwargs)
                logger.info("🤖 Agent generated a reply (patched method complete)")
                
                # Try to capture the response
                try:
                    if hasattr(agent, "_last_generated_message") and agent._last_generated_message:
                        msg_text = agent._last_generated_message
                        entry = {
                            "speaker": "AI",
                            "text": msg_text,
                            "timestamp": time.time()
                        }
                        transcript_entries.append(entry)
                        logger.debug(f"Added AI response via patched generate. Total entries: {len(transcript_entries)}")
                except Exception as e:
                    logger.error(f"❌ Error capturing response in patched_generate: {e}")
                
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
