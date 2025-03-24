import {
  AccessToken,
  AccessTokenOptions,
  VideoGrant,
} from "livekit-server-sdk";
import { NextResponse } from "next/server";

// NOTE: you are expected to define the following environment variables in `.env.local`:
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// don't cache the results
export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// dynamic session and token creation for the voice assistant.
// creates a unique identity and room name for the voice assistant.
// returns the connection details to the voice assistant.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");
    console.log('🚀 ~ GET ~ campaignId:', campaignId);

    if (!campaignId) {
      throw new Error("campaignId is required");
    }

    if (LIVEKIT_URL === undefined) {
      throw new Error("LIVEKIT_URL is not defined");
    }

    // Generate participant token
    const participantIdentity = `${campaignId}_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;
    
    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken: "dummy_token", // This will be handled by the backend
      participantName: participantIdentity,
    };
    const headers = new Headers({
      "Cache-Control": "no-store",
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}
