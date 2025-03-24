from __future__ import annotations

import logging
from dotenv import load_dotenv
import asyncio
import json
import random
import requests
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
from prompts import agent_prompt_template

# Store active tasks to prevent garbage collection
_active_tasks = set()

load_dotenv()
logger = logging.getLogger("livekit-agent-worker")
logger.setLevel(logging.INFO)

# List of female names to use for the AI interviewer
FEMALE_INTERVIEWER_NAMES = [
    "Emma", "Olivia", "Ava", "Isabella", "Sophia", 
    "Charlotte", "Amelia", "Mia", "Harper", "Evelyn",
    "Abigail", "Emily", "Elizabeth", "Sofia", "Ella", 
    "Madison", "Scarlett", "Victoria", "Aria", "Grace"
]

def generate_interviewer_name():
    """Generate a random female name for the AI interviewer"""
    return random.choice(FEMALE_INTERVIEWER_NAMES)

async def _forward_transcription(
    stt_stream: stt.SpeechStream,
    stt_forwarder: transcription.STTSegmentsForwarder,
):
    """Forward the transcription and log the transcript in the console"""
    async for ev in stt_stream:
        stt_forwarder.update(ev)
        if ev.type == stt.SpeechEventType.INTERIM_TRANSCRIPT:
            print(f"\n🗣️ INTERIM TRANSCRIPT: {ev.alternatives[0].text}", end="")
        elif ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
            print("\n")
            print("\n🎯 FINAL TRANSCRIPT:")
            print("=" * 80)
            print(ev.alternatives[0].text)
            print("=" * 80)
            print()


async def entrypoint(ctx: JobContext):
    # Generate a random interviewer name
    interviewer_name = generate_interviewer_name()
    logger.info(f"Using interviewer name: {interviewer_name}")
    
    stt = STT()
    tasks = []
    _accumulated_questions = []
    submission_data = None

    async def transcribe_track(participant: rtc.RemoteParticipant, track: rtc.Track):
        audio_stream = stt.AudioStream(track)
        print("AUDIO STREAM: ", audio_stream)
        stt_forwarder = transcription.STTSegmentsForwarder(
            room=ctx.room, participant=participant, track=track
        )
        stt_stream = stt.stream()
        stt_task = asyncio.create_task(
            _forward_transcription(stt_stream, stt_forwarder)
        )
        tasks.append(stt_task)
        async for segment in audio_stream:
            stt_stream.push_frame(segment.frame)

    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            tasks.append(asyncio.create_task(transcribe_track(participant, track)))

    async def async_handle_text_stream(reader, participant_identity):
        info = reader.info
        nonlocal submission_data  # Use nonlocal instead of global

        print(
            f"🚀 ~ async_handle_text_stream ~ info:",
            f"Text stream received from {participant_identity}\n" f"  {info.topic}",
        )

        async for chunk in reader:
            print(f"🚀 ~ async_handle_text_stream ~ chunk:", chunk)
            try:
                # Try to parse each chunk as JSON
                if chunk:
                    parsed_chunk = json.loads(chunk)
                    print(f"Successfully parsed JSON chunk: {parsed_chunk}")

                    # Store submission data
                    if "submission_id" in parsed_chunk:
                        submission_data = parsed_chunk
                        logger.info(f"Received submission data with ID: {parsed_chunk['submission_id']}")
                        
                        # Extract campaign ID if present
                        if "submission" in parsed_chunk and "campaign_id" in parsed_chunk["submission"]:
                            campaign_id = parsed_chunk["submission"]["campaign_id"]
                            logger.info(f"Extracted campaign ID: {campaign_id}")
                            
                            # Fetch additional data if needed
                            try:
                                # Fetch questions
                                questions_url = f"http://localhost:5000/api/questions?campaign_id={campaign_id}"
                                questions_response = requests.get(questions_url)
                                if questions_response.ok:
                                    questions = questions_response.json()
                                    question_titles = [q["title"] for q in questions]
                                    _accumulated_questions.extend(question_titles)
                                    logger.info(f"Fetched {len(question_titles)} questions")
                            except Exception as e:
                                logger.error(f"Error fetching additional data: {e}")

                    # If this chunk contains interview questions, process them
                    if "questions" in parsed_chunk and isinstance(
                        parsed_chunk["questions"], list
                    ):
                        _accumulated_questions.extend(parsed_chunk["questions"])
                        print(
                            f"Added {len(parsed_chunk['questions'])} questions to accumulated list"
                        )

            except json.JSONDecodeError as e:
                print(f"Error parsing chunk as JSON: {e}")
                # Continue processing other chunks even if one fails
            except Exception as e:
                logger.error(f"Unexpected error processing chunk: {e}")

    def handle_text_stream(reader, participant_identity):
        task = asyncio.create_task(
            async_handle_text_stream(reader, participant_identity)
        )
        _active_tasks.add(task)
        task.add_done_callback(lambda t: _active_tasks.remove(t))

    ctx.room.register_text_stream_handler("interview-questions", handle_text_stream)
    ctx.room.on("track_subscribed", on_track_subscribed)

    logger.info(f"🚀 connecting to room {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    
    # Extract submission ID from participant identity if possible
    submission_id = None
    try:
        submission_id = participant.identity.split('_')[0]
        logger.info(f"Extracted submission ID from participant identity: {submission_id}")
        
        # Fetch submission data if not received via text stream
        if not submission_data and submission_id:
            try:
                logger.info(f"Attempting to fetch submission data for ID: {submission_id}")
                submission_url = f"http://localhost:5000/api/submissions/{submission_id}"
                submission_response = requests.get(submission_url, timeout=5)  # Add timeout
                if submission_response.ok:
                    submission_data = submission_response.json()
                    if not isinstance(submission_data, dict):
                        logger.warning(f"Received non-dict submission data: {type(submission_data)}")
                        submission_data = {}
                    else:
                        logger.info(f"Fetched submission data for ID: {submission_id}")
                    
                    # Extract campaign ID
                    campaign_id = None
                    if submission_data:
                        campaign_id = submission_data.get("campaign_id") or (
                            submission_data.get("submission", {}).get("campaign_id")
                        )
                    
                    if campaign_id:
                        # Fetch campaign details
                        campaign_url = f"http://localhost:5000/api/campaigns/{campaign_id}"
                        campaign_response = requests.get(campaign_url, timeout=5)
                        if campaign_response.ok:
                            campaign_data = campaign_response.json()
                            if isinstance(campaign_data, dict):
                                submission_data["job_description"] = campaign_data.get("job_description", "")
                                submission_data["campaign_context"] = campaign_data.get("campaign_context", "")
                            else:
                                logger.warning(f"Received non-dict campaign data: {type(campaign_data)}")
                        
                        # Fetch questions if not already loaded
                        if not _accumulated_questions:
                            questions_url = f"http://localhost:5000/api/questions?campaign_id={campaign_id}"
                            questions_response = requests.get(questions_url, timeout=5)
                            if questions_response.ok:
                                questions = questions_response.json()
                                if isinstance(questions, list):
                                    question_titles = [q.get("title", "") for q in questions if isinstance(q, dict)]
                                    _accumulated_questions.extend(question_titles)
                                    logger.info(f"Fetched {len(question_titles)} questions")
                                else:
                                    logger.warning(f"Received non-list questions data: {type(questions)}")
            except requests.RequestException as e:
                logger.error(f"Request error fetching submission data: {e}")
            except Exception as e:
                logger.error(f"Error fetching submission data: {e}")
    except Exception as e:
        logger.error(f"Error processing participant identity: {e}")
    
    # Ensure submission_data is not None
    if submission_data is None:
        logger.warning("No submission data available - initializing empty dictionary")
        submission_data = {}
    
    # Use default questions if none were loaded
    if not _accumulated_questions:
        _accumulated_questions = [
            "Tell me about yourself",
            "What are your strengths and weaknesses?",
            "Why are you interested in this position?",
            "Describe a challenge you've faced and how you overcame it"
        ]
        logger.info("Using default questions as none were provided")
    
    # Start the multimodal agent
    try:
        run_multimodal_agent(ctx, participant, _accumulated_questions, submission_data, interviewer_name)
        logger.info("agent started successfully")
    except Exception as e:
        logger.error(f"Error starting multimodal agent: {e}")
        # Start with minimal data in case of error
        try:
            fallback_data = {
                "resume_text": "Not available",
                "job_description": "Not available"
            }
            run_multimodal_agent(ctx, participant, _accumulated_questions, fallback_data, interviewer_name)
            logger.info("agent started with fallback data")
        except Exception as e2:
            logger.error(f"Critical error starting agent even with fallback data: {e2}")

    logger.info("agent initialization completed")


def run_multimodal_agent(ctx: JobContext, participant: rtc.RemoteParticipant, questions, submission_data, interviewer_name):
    logger.info("starting multimodal agent")
    
    # Check if submission_data is None and provide default empty dict if needed
    if submission_data is None:
        logger.warning("No submission data available, using default values")
        submission_data = {}
    
    # Extract necessary data with fallbacks
    resume_text = submission_data.get("resume_text", "Not provided")
    job_description = submission_data.get("job_description", "Not provided")
    campaign_context = submission_data.get("campaign_context", "")
    
    # Format the question list
    formatted_questions = "\n".join([f"- {q}" for q in questions])
    
    # Build the full prompt
    full_prompt = agent_prompt_template.format(
        interviewer_name=interviewer_name,
        questions=formatted_questions,
        job_description=job_description,
        resume_text=resume_text,
        campaign_context=campaign_context
    )
    
    logger.info(f"Using prompt template with interviewer {interviewer_name} and {len(questions)} questions")

    model = openai.realtime.RealtimeModel(
        instructions=full_prompt,
        modalities=["audio", "text"],
    )

    # create a chat context with chat history, these will be synchronized with the server
    # upon session establishment
    chat_ctx = llm.ChatContext()
    chat_ctx.append(
        text=f"You are {interviewer_name}, an AI interviewer. You are conducting an interview for a job position. The candidate's resume says: {resume_text}. The job description is: {job_description}",
        role="assistant",
    )

    agent = MultimodalAgent(
        model=model,
        chat_ctx=chat_ctx,
    )
    agent.start(ctx.room, participant)

    # to enable the agent to speak first
    agent.generate_reply()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )