"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  LiveKitRoom,
  useVoiceAssistant,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  AgentState,
  DisconnectButton,
  useMaybeRoomContext,
} from "@livekit/components-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaDeviceFailure, RoomEvent } from "livekit-client";
import type { ConnectionDetails } from "../../app/api/connection-details/route";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { CloseIcon } from "@/components/CloseIcon";
import { useRouter } from 'next/router';
import { Room } from 'livekit-client';
import { TranscriptionSegment, Participant, TrackPublication } from "livekit-client";
import { Camera } from "react-camera-pro";

interface Submission {
  id: string;
  campaign_id: string;
  submission: {
    campaign_id: string;
    // Add other fields as needed
  };
}

// Transcriptions component
function Transcriptions() {
  const room = useMaybeRoomContext();
  const [transcriptions, setTranscriptions] = useState<{ [id: string]: TranscriptionSegment & { isCandidate?: boolean } }>({});
  const [fullTranscript, setFullTranscript] = useState<string>("");
  
  // Store transcripts in localStorage for retrieval when submitting
  useEffect(() => {
    if (fullTranscript) {
      localStorage.setItem('interviewTranscript', fullTranscript);
    }
  }, [fullTranscript]);

  useEffect(() => {
    if (!room) {
      return;
    }

    const updateTranscriptions = (
      segments: TranscriptionSegment[],
      participant?: Participant,
      publication?: TrackPublication
    ) => {
      console.log('Transcription received:', segments);
      setTranscriptions((prev) => {
        const newTranscriptions = { ...prev };
        for (const segment of segments) {
          // Determine if this is the candidate speaking (local participant)
          // or the AI interviewer (remote participant)
          const isCandidate = participant?.identity === room.localParticipant.identity;
          
          newTranscriptions[segment.id] = {
            ...segment,
            isCandidate
          };
          
          // Log each time something is spoken
          console.log(`Transcription (${isCandidate ? 'Candidate' : 'Interviewer'}): ${segment.text}`);
        }
        return newTranscriptions;
      });

      // Update the full transcript for submission
      const sortedSegments = [...Object.values(transcriptions), ...segments.map(segment => ({
        ...segment,
        isCandidate: participant?.identity === room.localParticipant.identity
      }))]
        .sort((a, b) => a.firstReceivedTime - b.firstReceivedTime);
      
      const transcript = sortedSegments.map(segment => 
        `${segment.isCandidate ? 'Candidate' : 'Interviewer'}: ${segment.text}`
      ).join('\n');
      
      setFullTranscript(transcript);
    };

    console.log('Setting up transcription listener');
    room.on(RoomEvent.TranscriptionReceived, updateTranscriptions);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, updateTranscriptions);
    };
  }, [room, transcriptions]);

  return (
    <div className="w-full overflow-y-auto p-4 bg-gray-100 rounded-md mt-4 max-h-[300px]">
      <div className="mb-2">
        <h3 className="text-lg font-medium">Transcriptions</h3>
      </div>
      <ul className="space-y-1">
        {Object.values(transcriptions)
          .sort((a, b) => a.firstReceivedTime - b.firstReceivedTime)
          .map((segment) => (
            <li 
              key={segment.id} 
              className={`text-sm p-1 ${segment.isCandidate ? 'text-blue-700' : 'text-green-700'}`}
            >
              <span className="font-medium">
                {segment.isCandidate ? 'You: ' : 'Interviewer: '}
              </span>
              {segment.text}
            </li>
          ))}
      </ul>
    </div>
  );
}

// Webcam component using react-camera-pro
function WebcamComponent({ isInterviewActive }: { isInterviewActive: boolean }) {
  const camera = useRef<any>(null);
  const [numberOfCameras, setNumberOfCameras] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  // Use a fixed ratio
  const aspectRatio = 9 / 16;

  const toggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
  };

  return (
    <div className="h-full bg-white rounded-lg overflow-hidden flex flex-col">
      <div className="relative">
        {/* Recording indicator */}
        {isInterviewActive && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-md">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <span>REC</span>
          </div>
        )}
        
        <div className="h-full p-4 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[480px]">
            {cameraEnabled ? (
              <Camera
                ref={camera}
                numberOfCamerasCallback={setNumberOfCameras}
                facingMode="user"
                aspectRatio={aspectRatio}
                errorMessages={{
                  noCameraAccessible: 'No camera available',
                  permissionDenied: 'Camera permission denied',
                  switchCamera: 'Cannot switch camera',
                  canvas: 'Canvas error',
                }}
              />
            ) : (
              <div className="bg-gray-800 rounded-lg aspect-video flex flex-col items-center justify-center">
                <svg 
                  className="w-16 h-16 text-gray-400 mb-2" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.465a5 5 0 01-.293-.707l-.002-.004A4.981 4.981 0 015 12c0-.975.223-1.898.627-2.724l.002-.004a4.981 4.981 0 011.218-1.649l.025-.027a5.008 5.008 0 013.128-1.587m0-2.049a7.002 7.002 0 01-6.074 6.073m12.149-12.149a7.004 7.004 0 016.073 6.074M13 19.92v.002M21.92 13h.002" 
                  />
                  <line 
                    x1="2" 
                    y1="2" 
                    x2="22" 
                    y2="22" 
                    strokeWidth={1.5} 
                  />
                </svg>
                <p className="text-gray-300 text-lg font-medium">Camera disabled</p>
                <p className="text-gray-400 text-sm mt-1">Click the button below to enable</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Camera controls - only show when interview is active */}
      {isInterviewActive ? (
        <div className="p-4 border-t border-gray-200">
          <div className="flex justify-center gap-4">
            <button 
              onClick={toggleCamera}
              className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors duration-200 ${
                cameraEnabled 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {cameraEnabled ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    <line x1="18" y1="6" x2="6" y2="18" strokeWidth={2} />
                  </svg>
                  Disable Camera
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Enable Camera
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Timer component to show elapsed interview time
function InterviewTimer() {
  const [seconds, setSeconds] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(seconds => seconds + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Format time as MM:SS
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="text-center py-2 bg-gray-800 text-white font-mono text-lg rounded-md">
      {formatTime(seconds)}
    </div>
  );
}

export default function Page() {
  const [connectionDetails, updateConnectionDetails] = useState<
    ConnectionDetails | undefined
  >(undefined);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [interviewData, setInterviewData] = useState<any>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastActiveTimestamp, setLastActiveTimestamp] = useState<number>(Date.now());
  const [inactivePrompt, setInactivePrompt] = useState<boolean>(false);
  const [noActivityTime, setNoActivityTime] = useState<number>(0);
  
  // Track if interview is active
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const roomRef = useRef<Room | null>(null);
  
  const router = useRouter();
  const { submissionId } = router.query;

  // First fetch submission details to get campaign_id
  useEffect(() => {
    // Wait for router to be ready and have submissionId
    if (!router.isReady) return;
    
    console.log('Router is ready, submissionId:', submissionId);
    
    const fetchSubmission = async () => {
      if (!submissionId) {
        console.error('No submissionId available');
        setError('Interview ID is missing');
        return;
      }
      
      try {
        console.log('Fetching submission data for ID:', submissionId);
        const response = await fetch(`/api/submissions/${submissionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch submission');
        }
        const data = await response.json();
        console.log('Received submission data:', data);
        setSubmission(data);
      } catch (err) {
        console.error('Error fetching submission:', err);
        setError('Failed to load submission details');
      }
    };

    fetchSubmission();
  }, [router.isReady, submissionId]);

  // More aggressive activity monitoring
  useEffect(() => {
    if (!isInterviewActive || !roomRef.current) return;
    
    console.log("Setting up activity monitoring");
    
    // Check every 10 seconds for inactivity and increase counter
    const intervalCheck = setInterval(() => {
      // If agent is speaking or listening, reset counter
      if (agentState === 'speaking' || agentState === 'listening') {
        if (noActivityTime > 0) {
          console.log("Resetting inactivity counter due to agent state");
          setNoActivityTime(0);
        }
        return;
      }
      
      // Otherwise, increment counter
      setNoActivityTime(prev => prev + 10);
      
      // Every 30 seconds of inactivity, take action
      if (noActivityTime > 0 && noActivityTime % 30 === 0) {
        console.log(`${noActivityTime}s of inactivity detected, sending activity signal`);
        
        try {
          // Send artificial activity to keep connection alive
          if (roomRef.current && roomRef.current.state === 'connected') {
            // Option 1: Send data as if user clicked something
            roomRef.current.localParticipant.publishData(
              new TextEncoder().encode(JSON.stringify({
                type: 'user-activity',
                timestamp: Date.now()
              })),
              { reliable: true }
            );
            
            // Option 2: If appropriate, play a short sound
            // This can sometimes help wake up audio processing
            if (noActivityTime > 60) {
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
              
              const gainNode = audioContext.createGain();
              gainNode.gain.setValueAtTime(0.01, audioContext.currentTime); // Very quiet
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.start();
              setTimeout(() => {
                oscillator.stop();
                setTimeout(() => audioContext.close(), 100);
              }, 100);
              
              console.log("Played audio ping to wake up audio context");
            }
          }
        } catch (e) {
          console.error("Error sending activity signal:", e);
        }
      }
    }, 10000);
    
    return () => {
      clearInterval(intervalCheck);
      setNoActivityTime(0);
    };
  }, [isInterviewActive, agentState, noActivityTime]);

  // Set up watchdog timer for agent inactivity
  useEffect(() => {
    if (!isInterviewActive) return;

    // Update timestamp when agent changes state
    if (agentState === 'speaking' || agentState === 'listening') {
      console.log(`Agent state changed to ${agentState}, updating activity timestamp`);
      setLastActiveTimestamp(Date.now());
      setInactivePrompt(false);
      setNoActivityTime(0); // Reset inactivity counter
    }

    // Check for inactivity
    const inactivityInterval = setInterval(() => {
      const currentTime = Date.now();
      const inactiveTime = currentTime - lastActiveTimestamp;

      // If agent has been inactive for more than 20 seconds
      if (inactiveTime > 20000 && !inactivePrompt) {
        console.log(`Agent appears inactive for ${inactiveTime/1000}s, attempting to prompt activity`);
        setInactivePrompt(true);
        
        // Try to prompt the agent by simulating user interaction
        if (roomRef.current && agentState !== 'speaking') {
          try {
            console.log('Sending prompt to agent...');
            
            // Send a brief "I'm here" message to wake up the agent
            roomRef.current.localParticipant.publishData(
              new TextEncoder().encode(JSON.stringify({
                type: 'prompt',
                message: 'continue',
                timestamp: Date.now()
              })),
              { reliable: true }
            );
            
            // Dispatch event for good measure
            const promptEvent = new Event('prompt');
            document.dispatchEvent(promptEvent);
            
            // Force reconnect if needed after 5 more seconds of inactivity
            setTimeout(() => {
              if (Date.now() - lastActiveTimestamp > 25000 && isInterviewActive) {
                console.log("Still inactive, forcing audio reconnection");
                // Toggle audio to force reconnection
                if (roomRef.current && roomRef.current.state === 'connected') {
                  const localParticipant = roomRef.current.localParticipant;
                  
                  // Toggle audio without checking audioTracks
                  navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(stream => {
                      const track = stream.getAudioTracks()[0];
                      if (track && roomRef.current && roomRef.current.state === 'connected') {
                        try {
                          const pub = localParticipant.publishTrack(track);
                          setTimeout(() => {
                            if (roomRef.current && roomRef.current.state === 'connected') {
                              localParticipant.unpublishTrack(track);
                            }
                            stream.getTracks().forEach(t => t.stop());
                          }, 1000);
                        } catch (err) {
                          // Make sure to clean up the stream on error
                          stream.getTracks().forEach(t => t.stop());
                          console.error("Error during reconnection:", err);
                        }
                      } else {
                        // Make sure to clean up if we can't reconnect
                        stream.getTracks().forEach(t => t.stop());
                      }
                    })
                    .catch(err => console.error("Error toggling audio:", err));
                }
              }
            }, 5000);
          } catch (err) {
            console.error('Error prompting agent:', err);
          }
        }
      }
    }, 5000);

    return () => clearInterval(inactivityInterval);
  }, [isInterviewActive, agentState, lastActiveTimestamp, inactivePrompt]);

  // Handle possible reconnection
  useEffect(() => {
    if (!isInterviewActive || !connectionDetails) return;

    // Set up a ping to keep the connection active
    const pingInterval = setInterval(() => {
      if (roomRef.current && roomRef.current.state === 'connected') {
        console.log('Sending periodic ping to keep connection alive');
        // Send empty data to keep connection alive
        try {
          roomRef.current.localParticipant.publishData(new Uint8Array([0]), { reliable: true });
        } catch (err) {
          console.error('Error sending ping:', err);
        }
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isInterviewActive, connectionDetails]);

  const onConnectButtonClicked = useCallback(async () => {
    let campaignId = submission?.submission.campaign_id;

    if (!submissionId || !campaignId) {
      console.error("Submission ID or Campaign ID is not available");
      return;
    }

    setIsLoading(true);

    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
      "/api/connection-details",
      window.location.origin
    );

    // Use submissionId for LiveKit room
    url.searchParams.append("submissionId", submissionId.toString());
    url.searchParams.append("campaignId", campaignId);

    // Add max retry logic
    let retries = 0;
    const maxRetries = 3;
    
    const connectWithRetry = async () => {
      try {
    const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to get connection details');
        }
    const connectionDetailsData = await response.json();
    updateConnectionDetails(connectionDetailsData);

        const room = new Room({
          // Add configuration for better connection stability
          adaptiveStream: false,
          dynacast: false,
          disconnectOnPageLeave: false, // Don't disconnect on tab blur/visibility change
          stopLocalTrackOnUnpublish: false,
        });
        
        roomRef.current = room;
        
        // Setup event listeners for better debugging
        room.on(RoomEvent.Disconnected, () => {
          console.log('Room disconnected, attempting to reconnect...');
          
          // Try to reconnect if interview is still active
          if (isInterviewActive) {
            setTimeout(() => {
              if (isInterviewActive) {
                console.log('Attempting to reconnect to room...');
                room.connect(connectionDetailsData.serverUrl, connectionDetailsData.participantToken)
                  .catch(err => console.error('Reconnection failed:', err));
              }
            }, 2000);
          }
        });
        
        room.on(RoomEvent.Connected, () => {
          console.log('Successfully connected to room');
        });
        
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log(`Subscribed to track: ${track.kind} from ${participant.identity}`);
        });
        
    await room.connect(connectionDetailsData.serverUrl, connectionDetailsData.participantToken);

        // Send both submission and campaign data to the voice assistant
        const interviewContext = {
          ...submission, // Include all submission data
          submission_id: submissionId,
        };
        
        await room.localParticipant.sendText(JSON.stringify(interviewContext), {
            topic: 'interview-questions',
          });
        setInterviewData(interviewContext);
        setIsInterviewActive(true); // Set interview as active
        setLastActiveTimestamp(Date.now()); // Initialize activity timestamp
        setIsLoading(false);
      } catch (err) {
        console.error(`Connection attempt ${retries + 1} failed:`, err);
        
        if (retries < maxRetries) {
          retries++;
          console.log(`Retrying connection (${retries}/${maxRetries})...`);
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 2000 * retries));
          return connectWithRetry();
        }
        
        setIsLoading(false);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };
    
    connectWithRetry();
  }, [submissionId, submission]);

  // Function to end interview
  const submitInterview = async () => {
    try {
      // Get the full transcript from localStorage
      const fullTranscript = localStorage.getItem('interviewTranscript') || "No transcript available";
      
      const response = await fetch('/api/submit_interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          transcript: fullTranscript,
          submissionId: submissionId,
        }),
      });
      
      if (response.ok) {
        console.log('Interview submitted successfully');
        alert('Interview submitted successfully');
        setIsInterviewActive(false);
        updateConnectionDetails(undefined); // Disconnect from LiveKit
        localStorage.removeItem('interviewTranscript'); // Clean up storage
      } else {
        console.error('Failed to submit interview');
        alert('Failed to submit interview');
      }
    } catch (error) {
      console.error('Error submitting interview:', error);
      alert('Error submitting interview');
    }
  };

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <main data-lk-theme="default" className="h-screen">
      <LiveKitRoom
        token={connectionDetails?.participantToken}
        serverUrl={connectionDetails?.serverUrl}
        connect={connectionDetails !== undefined}
        audio={true}
        video={false}
        onMediaDeviceFailure={onDeviceFailure}
        onDisconnected={() => {
          console.log("LiveKit room disconnected, attempting to recover");
          // Don't immediately reset connection details
          // Instead, set a timeout to allow for potential reconnection
          if (roomRef.current) {
            // Clear any existing reconnection timeout
            if ((roomRef.current as any)._reconnectTimeout) {
              clearTimeout((roomRef.current as any)._reconnectTimeout);
            }
            
            // Set a new reconnection timeout
            (roomRef.current as any)._reconnectTimeout = setTimeout(() => {
              // Only reset if still disconnected
              if (isInterviewActive && roomRef.current?.state !== 'connected') {
                console.log("Connection not recovered after timeout, resetting state");
                updateConnectionDetails(undefined);
                setIsInterviewActive(false);
                alert("The connection to the interview was lost. Please try reconnecting.");
              }
            }, 5000);
          }
        }}
        options={{
          adaptiveStream: false,
          dynacast: false,
        }}
        // Add event handlers to track connection state
        onConnected={() => {
          console.log("LiveKit room connected successfully");
          // Reset any error states that might have been set
          setError(null);
          setLastActiveTimestamp(Date.now());
        }}
      >
        <div className="flex flex-col md:flex-row p-4 gap-4">
          {/* Left column - Agent and Transcription */}
          <div className="flex-1 flex flex-col gap-4">
            <div>
        <SimpleVoiceAssistant onStateChange={setAgentState} />
            </div>
            
            {/* Show timer when interview is active */}
            {isInterviewActive && <InterviewTimer />}
            
            {isInterviewActive && <Transcriptions />}
            
            {isInterviewActive ? (
        <ControlBar
          onConnectButtonClicked={onConnectButtonClicked}
          agentState={agentState}
        />
            ) : (
              <div className="flex justify-center items-center p-4">
                <button
                  onClick={onConnectButtonClicked}
                  disabled={isLoading}
                  className={`
                    bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md px-6 py-3 
                    transition duration-200 ease-in-out focus:outline-none focus:ring-2 
                    focus:ring-blue-500 focus:ring-opacity-50
                    ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Connecting...
                    </span>
                  ) : (
                    'Begin Interview'
                  )}
                </button>
              </div>
            )}
            
        <RoomAudioRenderer />
        <NoAgentNotification state={agentState} />
          </div>
          
          {/* Right column - Webcam */}
          <div className="flex-1 h-full flex flex-col">
            <WebcamComponent isInterviewActive={isInterviewActive} />
            
            {/* Submit button at the bottom of the right column when interview is active */}
            {isInterviewActive && (
              <div className="mt-4">
                <button
                  onClick={submitInterview}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium rounded-md px-4 py-2 transition duration-200 ease-in-out"
                >
                  Submit Interview
                </button>
              </div>
            )}
          </div>
        </div>
      </LiveKitRoom>
    </main>
  );
}

function SimpleVoiceAssistant(props: {
  onStateChange: (state: AgentState) => void;
}) {
  const { state } = useVoiceAssistant();
  const prevStateRef = useRef<AgentState>("disconnected");
  const [stuckCounter, setStuckCounter] = useState(0);
  const [showRecoveryButton, setShowRecoveryButton] = useState(false);
  const room = useMaybeRoomContext();
  
  // Reset stuck counter when state changes
  useEffect(() => {
    if (prevStateRef.current !== state) {
      setStuckCounter(0);
      setShowRecoveryButton(false);
    }
  }, [state]);
  
  // Try to recover if stuck
  const attemptRecovery = useCallback(() => {
    if (!room) return;
    
    console.log("Attempting to recover agent state");
    
    // Try to manually trigger the agent to continue
    try {
      // Send a small data packet to wake up the connection
      room.localParticipant.publishData(new Uint8Array([1, 2, 3]), { reliable: true });
      
      // Try to publish some audio to wake up audio processing
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const track = stream.getAudioTracks()[0];
          if (track && room.state === 'connected') {
            // Use the track directly instead of creating a new MediaStreamTrack
            try {
              const pub = room.localParticipant.publishTrack(track);
              // Unpublish after a moment
              setTimeout(() => {
                if (room.state === 'connected') {
                  room.localParticipant.unpublishTrack(track);
                }
                // Release the media stream
                stream.getTracks().forEach(track => track.stop());
              }, 500);
            } catch (err) {
              // Cleanup on error
              stream.getTracks().forEach(track => track.stop());
              console.error("Error publishing recovery track:", err);
            }
          } else {
            // Cleanup if room is disconnected or no track
            stream.getTracks().forEach(track => track.stop());
          }
        })
        .catch(err => console.error("Error accessing audio for recovery:", err));
      
      setShowRecoveryButton(false);
    } catch (err) {
      console.error("Recovery attempt failed:", err);
    }
  }, [room]);
  
  // Avoid infinite updates by not updating state in every render
  useEffect(() => {
    // Only trigger state change when the state actually changes
    if (prevStateRef.current !== state) {
      console.log(`Agent state changed: ${prevStateRef.current} -> ${state}`);
      props.onStateChange(state);
      prevStateRef.current = state;
      
      // If the agent is speaking, add a timeout to check if it stops speaking
      if (state === 'speaking') {
        const speakingTimeout = setTimeout(() => {
          // Check if we're still in the speaking state after timeout
          if (prevStateRef.current === 'speaking') {
            console.log('Agent may be stuck in speaking state, trying to recover...');
            // Increment stuck counter
            setStuckCounter(prev => prev + 1);
            
            // After multiple stuck events, show recovery button
            if (stuckCounter >= 2) {
              setShowRecoveryButton(true);
            }
            
            // Dispatch a custom event that our activity monitoring can detect
            document.dispatchEvent(new CustomEvent('agent-state-stuck', { 
              detail: { state: 'speaking' } 
            }));
          }
        }, 30000); // 30 seconds timeout
        
        return () => clearTimeout(speakingTimeout);
      }
    }
  }, [props, state, stuckCounter]); // Include stuckCounter in dependencies

  return (
    <div className="h-[200px] flex flex-col items-center justify-center">
      <div 
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
          state === 'speaking' ? 'bg-blue-500 scale-110' : 
          state === 'listening' ? 'bg-green-500 animate-pulse' : 
          state === 'connecting' ? 'bg-yellow-500' : 'bg-gray-300'
        }`}
      >
        <div className="text-white font-medium">
          {state === 'speaking' ? 'Speaking' : 
           state === 'listening' ? 'Listening' : 
           state === 'connecting' ? 'Connecting' : 'Ready'}
        </div>
      </div>
      
      {showRecoveryButton && (
        <button
          onClick={attemptRecovery}
          className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
        >
          Resume Conversation
        </button>
      )}
    </div>
  );
}

function ControlBar(props: {
  onConnectButtonClicked: () => void;
  agentState: AgentState;
}) {
  return (
    <div className="relative h-[70px]">
      <AnimatePresence>
        {props.agentState === "disconnected" && (
          <motion.button
            initial={{ opacity: 0, top: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 1, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="uppercase absolute left-1/2 -translate-x-1/2 px-4 py-2 bg-white text-black rounded-md"
            onClick={() => props.onConnectButtonClicked()}
          >
            Start My Interview
          </motion.button>
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
              <VoiceAssistantControlBar controls={{ leave: false }} />
              <DisconnectButton>
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
