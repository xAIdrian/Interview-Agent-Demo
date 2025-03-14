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
    global_ctx = ctx

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

    # @ctx.room.on("track_subscribed")
    # def on_track_subscribed(
    #     track: rtc.Track,
    #     publication: rtc.TrackPublication,
    #     participant: rtc.RemoteParticipant,
    # ):
    #     if track.kind == rtc.TrackKind.KIND_AUDIO:
    #         tasks.append(asyncio.create_task(transcribe_track(participant, track)))

    logger.info(f"connecting to room {ctx.room.name}")
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
