"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  AgentState,
  DisconnectButton,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useDataChannel,
} from "@livekit/components-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaDeviceFailure, Track, DataPacket_Kind, RoomEvent, RemoteParticipant } from "livekit-client";
import type { ConnectionDetails } from "../../app/api/connection-details/route";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { CloseIcon } from "@/components/CloseIcon";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { useRouter } from 'next/router';
import { PageTemplate } from '../../components/PageTemplate';
import { PrimaryButton } from "@/components/Button";
import axios from 'axios';
import { Room } from "livekit-client";
// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Define interface for transcript entries
interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
}

// Define message structure for data channel
interface TranscriptMessage {
  type: string;
  speaker: string;
  text: string;
}

// Define submission interface
interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_complete: boolean;
  total_points: number | null;
  resume_path: string | null;
  resume_text: string | null;
}

export default function Page() {
  const [connectionDetails, updateConnectionDetails] = useState<ConnectionDetails | undefined>(undefined);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [interviewData, setInterviewData] = useState<any>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [agentMessages, setAgentMessages] = useState<string[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const router = useRouter();
  const { campaignId } = router.query;

  // Reference to track if interview has ended
  const interviewEndedRef = useRef(false);

  // Fetch submission data (including resume text)
  useEffect(() => {
    if (!campaignId) return;
    
    const fetchSubmissionData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/submissions/${campaignId}`);
        setSubmission(response.data);
        
        // If submission has resume text, share it with the interview agent
        if (response.data.resume_text) {
          console.log("Resume text available:", response.data.resume_text.substring(0, 100) + "...");
        }
      } catch (error) {
        console.error("Error fetching submission data:", error);
      }
    };
    
    fetchSubmissionData();
  }, [campaignId]);

  const onConnectButtonClicked = useCallback(async () => {
    if (!campaignId) {
      console.error("Candidate ID is not available");
      return;
    }

    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? 
      "/api/connection-details",
      window.location.origin
    );
    url.searchParams.append("campaignId", campaignId.toString());

    const response = await fetch(url.toString());
    const connectionDetailsData = await response.json();
    updateConnectionDetails(connectionDetailsData);

    const room = new Room();
    await room.connect(connectionDetailsData.serverUrl, connectionDetailsData.participantToken);

    if (campaignId) {
      fetch(`/api/interview/${campaignId}`)
        .then((response) => response.json())
        .then(async (data) => {
          const info = await room.localParticipant.sendText(JSON.stringify(data), {
            topic: 'interview-questions',
          });
          console.log('🚀 ~ info ~ info:', info);
        })
        .catch((error) => console.error('Error fetching interview data:', error));
    }
  }, [campaignId]);

  // Function to handle interview completion
  const handleInterviewComplete = useCallback(() => {
    if (interviewEndedRef.current) return;
    interviewEndedRef.current = true;
    
    console.log("Interview completed!");
    console.log("Full transcript:", transcript);
    
    if (transcript.length > 0) {
      localStorage.setItem('lastInterviewTranscript', JSON.stringify(transcript));
    }
  }, [transcript]);

  // Helper to check if agent is ready to receive questions
  const isAgentReady = (state: AgentState) => {
    return state !== "disconnected" && state !== "connecting";
  };

  return (
    <PageTemplate title="Interview Session" centered maxWidth="md">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">AI Interview</h2>
        
        {/* Resume info section */}
        {submission?.resume_text && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700">Resume Preview</h3>
            <div className="mt-1 text-xs text-gray-600 max-h-20 overflow-y-auto">
              {submission.resume_text.substring(0, 300)}...
            </div>
          </div>
        )}
        
        <div 
          data-lk-theme="default" 
          className="bg-[var(--lk-bg)]"
        >
          <LiveKitRoom
            token={connectionDetails?.participantToken}
            serverUrl={connectionDetails?.serverUrl}
            connect={connectionDetails !== undefined}
            audio={true}
            video={true}
            onMediaDeviceFailure={onDeviceFailure}
            onDisconnected={() => {
              updateConnectionDetails(undefined);
              handleInterviewComplete();
            }}
            className="grid grid-rows-[1fr_auto]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left side - Audio Visualization and Messages */}
              <div className="flex flex-col h-[300px]">
                <div className="flex-1 flex items-center justify-center">
                  <SimpleVoiceAssistant 
                    onStateChange={setAgentState} 
                    onMessageReceived={(message) => {
                      setAgentMessages(prev => [...prev, message]);
                      
                      setTranscript(prev => [
                        ...prev, 
                        {
                          speaker: "AI",
                          text: message,
                          timestamp: Date.now() / 1000
                        }
                      ]);
                    }}
                  />
                </div>
                
                {/* Agent Messages */}
                <div className="mt-4 h-[100px] overflow-y-auto bg-gray-50 p-2 rounded">
                  {agentMessages.length > 0 ? (
                    <div className="text-sm">
                      <strong>Current Question:</strong>
                      <p>{agentMessages[agentMessages.length - 1]}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 flex items-center justify-center h-full">
                      {isAgentReady(agentState) ? "Waiting for the first question..." : "Connect to start the interview"}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right side - Candidate's Webcam */}
              <div className="h-[300px] flex items-center justify-center bg-gray-100 rounded-lg">
                <CandidateVideo 
                  onTrackStarted={(track) => {
                    // When video track starts, we can listen for candidate audio
                    const transcriptListener = (text: string) => {
                      setTranscript(prev => [
                        ...prev, 
                        {
                          speaker: "Candidate",
                          text: text,
                          timestamp: Date.now() / 1000
                        }
                      ]);
                    };
                    
                    // Logic for hooking into speech recognition if needed
                  }}
                />
              </div>
            </div>
            
            <RemoteAudioTracks />
            <ControlBar
              onConnectButtonClicked={onConnectButtonClicked}
              agentState={agentState}
              onDisconnectClicked={handleInterviewComplete}
            />
            <NoAgentNotification state={agentState} />
          </LiveKitRoom>
        </div>
      </div>
    </PageTemplate>
  );
}

function RemoteAudioTracks() {
  const participants = useParticipants();
  
  return (
    <div style={{ display: 'none' }}> 
      {participants.filter(p => !p.isLocal).map((participant) => (
        <RoomAudioRenderer 
          key={`audio-${participant.identity}`}
        />
      ))}
    </div>
  );
}

function CandidateVideo({ onTrackStarted }: { onTrackStarted?: (track: Track) => void }) {
  const { localParticipant } = useLocalParticipant();
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [hasTrack, setHasTrack] = useState(false);
  
  useEffect(() => {
    if (!localParticipant || !videoEl) return;
    
    // Find the camera track
    const cameraPublication = localParticipant.getTrackPublications().find(
      pub => pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera
    );
    
    if (cameraPublication?.track) {
      const videoTrack = cameraPublication.track;
      videoTrack.attach(videoEl);
      setHasTrack(true);
      
      // Notify parent when track is started
      if (onTrackStarted) {
        onTrackStarted(videoTrack);
      }
      
      return () => {
        videoTrack.detach(videoEl);
        setHasTrack(false);
      };
    } else {
      setHasTrack(false);
    }
  }, [localParticipant, videoEl, onTrackStarted]);
  
  if (!localParticipant) {
    return <div className="text-center text-gray-500">Not connected</div>;
  }
  
  if (!hasTrack) {
    return <div className="text-center text-gray-500">Camera not available</div>;
  }
  
  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative">
      <video
        ref={setVideoEl}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}

function SimpleVoiceAssistant(props: {
  onStateChange: (state: AgentState) => void;
  onMessageReceived?: (message: string) => void;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  const room = useRoomContext();
  
  useEffect(() => {
    props.onStateChange(state);
    
    // Handle messages from the agent/backend
    const handleAgentMessage = (text: string) => {
      if (props.onMessageReceived) {
        props.onMessageReceived(text);
      }
    };
    
    if (room && room.localParticipant) {
      // Listen for data messages
      const handleDataReceived = (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          // Convert binary payload to string
          const text = new TextDecoder().decode(payload);
          
          try {
            // Try to parse as JSON
            const data = JSON.parse(text) as TranscriptMessage;
            if (data.type === "transcript" && data.speaker === "AI") {
              handleAgentMessage(data.text);
            }
          } catch (e) {
            // If not JSON, use as plain text
            handleAgentMessage(text);
          }
        } catch (e) {
          console.error("Error processing received data:", e);
        }
      };
      
      // Add event listener
      room.on(RoomEvent.DataReceived, handleDataReceived);
      
      return () => {
        room.off(RoomEvent.DataReceived, handleDataReceived);
      };
    }
  }, [props, state, room]);
  
  // This is the hook to get data channel messages
  const { message } = useDataChannel();
  
  // When message changes, process it
  useEffect(() => {
    if (!message || !props.onMessageReceived) return;
    
    try {
      // Try to decode and parse
      const text = new TextDecoder().decode(message.payload);
      try {
        const data = JSON.parse(text) as TranscriptMessage;
        if (data.type === "transcript" && data.speaker === "AI") {
          props.onMessageReceived(data.text);
        }
      } catch (e) {
        // Use as plain text if not JSON
        props.onMessageReceived(text);
      }
    } catch (e) {
      console.error("Error processing data channel message:", e);
    }
  }, [message, props]);
  
  return (
    <div className="h-[200px] w-full mx-auto flex items-center justify-center">
      <div className="w-full h-[200px] min-h-[100px] flex items-center justify-center">
        <BarVisualizer
          state={state}
          barCount={5}
          trackRef={audioTrack}
          className="w-full h-full min-h-[100px]"
          options={{
            minHeight: 24
          }}
        />
      </div>
    </div>
  );
}

function ControlBar(props: {
  onConnectButtonClicked: () => void;
  agentState: AgentState;
  onDisconnectClicked?: () => void;
}) {
  const krisp = useKrispNoiseFilter();
  useEffect(() => {
    krisp.setNoiseFilterEnabled(true);
  }, []);

  return (
    <div className="relative h-[100px]">
      <AnimatePresence>
        {props.agentState === "disconnected" && (
          <button
            className="mx-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => props.onConnectButtonClicked()}
          >
            Start My Interview
          </button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {props.agentState !== "disconnected" &&
          props.agentState !== "connecting" && (
            <motion.div
              initial={{ opacity: 0, top: "10px" }}
              animate={{ opacity: 1, top: 0 }}
              exit={{ opacity: 0, top: "-10px" }}
              transition={{ duration: 0.4, ease: [0.09, 1.04, 0.245, 1.055] }}
              className="flex h-8 absolute left-1/2 -translate-x-1/2 justify-center"
            >
              <RoomAudioRenderer />
              <VoiceAssistantControlBar controls={{ leave: false }} />
              <DisconnectButton onClick={props.onDisconnectClicked}>
                <CloseIcon />
              </DisconnectButton>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

function onDeviceFailure(error?: MediaDeviceFailure) {
  console.error(error);
  alert(
    "Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}
