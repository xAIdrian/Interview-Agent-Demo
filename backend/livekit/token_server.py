import os
from livekit import api
from dotenv import load_dotenv
import uuid
import logging
import json

logger = logging.getLogger("livekit-token")
logger.setLevel(logging.INFO)

load_dotenv()


class LiveKitTokenServer:
    @staticmethod
    async def generate_room_name():
        """Generate a unique room name"""
        name = "interview-" + str(uuid.uuid4())[:8]
        rooms = await LiveKitTokenServer.get_rooms()
        while name in rooms:
            name = "interview-" + str(uuid.uuid4())[:8]
        return name

    @staticmethod
    async def get_rooms():
        """Get all existing room names"""
        api_client = api.LiveKitAPI()
        rooms = await api_client.room.list_rooms(api.ListRoomsRequest())
        await api_client.aclose()
        return [room.name for room in rooms.rooms]

    @staticmethod
    def generate_token(campaign_id: str, room: str, language: str = "en") -> str:
        """Generate a LiveKit token for joining a room"""
        api_key = os.getenv("LIVEKIT_API_KEY")
        api_secret = os.getenv("LIVEKIT_API_SECRET")

        if not api_key or not api_secret:
            raise ValueError("LiveKit API key and secret must be set")

        # Create token
        token = (
            api.AccessToken(
                os.getenv("LIVEKIT_API_KEY"), os.getenv("LIVEKIT_API_SECRET")
            )
            .with_identity(campaign_id)
            .with_name(campaign_id)
            .with_grants(api.VideoGrants(room_join=True, room=room))
            .with_metadata(json.dumps({"language": language}))
        )

        return token.to_jwt()
