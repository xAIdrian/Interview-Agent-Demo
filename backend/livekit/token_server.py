import os
from livekit import api
from dotenv import load_dotenv
import uuid
import logging

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
    def generate_token(name, room=None):
        """Generate a LiveKit access token"""
        logger.info(f"Generating token for {name} in room {room}")
        
        # Check for required environment variables
        if not os.getenv("LIVEKIT_API_KEY") or not os.getenv("LIVEKIT_API_SECRET"):
            logger.error("LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set")
            raise ValueError("LiveKit API key and secret must be set in environment variables")
        
        # Create token
        token = api.AccessToken(os.getenv("LIVEKIT_API_KEY"), os.getenv("LIVEKIT_API_SECRET")) \
            .with_identity(name) \
            .with_name(name) \
            .with_grants(api.VideoGrants(
                room_join=True,
                room=room
            ))
        
        return token.to_jwt() 