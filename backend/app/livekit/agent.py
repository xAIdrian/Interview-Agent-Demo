from __future__ import annotations

import logging
from dotenv import load_dotenv
import asyncio
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
from prompts import sample_agent_prompt, sample_resume
import asyncio
import json

# Store active tasks to prevent garbage collection
_active_tasks = set()


load_dotenv()
logger = logging.getLogger("livekit-agent-worker")
logger.setLevel(logging.INFO)

prompting_questions = []
global_ctx = None


async def _forward_transcription(
    stt_stream: stt.SpeechStream,
    stt_forwarder: transcription.STTSegmentsForwarder,
):
    """Forward the transcription and log the transcript in the console"""
    async for ev in stt_stream:
        stt_forwarder.update(ev)
        if ev.type == stt.SpeechEventType.INTERIM_TRANSCRIPT:
            print(ev.alternatives[0].text, end="")
        elif ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
            print("\n")
            print(" -> ", ev.alternatives[0].text)


async def entrypoint(ctx: JobContext):
    stt = STT()
    tasks = []
    _accumulated_questions = []

    async def transcribe_track(participant: rtc.RemoteParticipant, track: rtc.Track):
        audio_stream = stt.AudioStream(track)
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
    run_multimodal_agent(ctx, participant)

    logger.info("agent started")


def run_multimodal_agent(ctx: JobContext, participant: rtc.RemoteParticipant):
    logger.info("starting multimodal agent")

    model = openai.realtime.RealtimeModel(
        instructions=(sample_agent_prompt),
        modalities=["audio", "text"],
    )

    # create a chat context with chat history, these will be synchronized with the server
    # upon session establishment
    chat_ctx = llm.ChatContext()
    chat_ctx.append(
        text=f"Context about the user: {sample_resume}",
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
