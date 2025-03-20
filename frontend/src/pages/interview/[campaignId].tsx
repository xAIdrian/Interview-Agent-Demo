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
} from "@livekit/components-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaDeviceFailure, Track, Participant, LocalParticipant } from "livekit-client";
import type { ConnectionDetails } from "../../app/api/connection-details/route";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { CloseIcon } from "@/components/CloseIcon";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { useRouter } from 'next/router';
import { PageTemplate } from '../../components/PageTemplate';
import { PrimaryButton } from "@/components/Button";

export default function Page() {
  const [connectionDetails, updateConnectionDetails] = useState<
    ConnectionDetails | undefined
  >(undefined);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [interviewData, setInterviewData] = useState<any>(null);
  const router = useRouter();
  const { campaignId } = router.query;

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
    // Append the campaignId as a query parameter
    url.searchParams.append("campaignId", campaignId.toString());

    const response = await fetch(url.toString());
    const connectionDetailsData = await response.json();
    updateConnectionDetails(connectionDetailsData);
  }, [campaignId]);

  // useEffect(() => {
  //   if (campaignId) {
  //     fetch(`/api/interview/${campaignId}`)
  //       .then((response) => response.json())
  //       .then((data) => {
  //         setInterviewData(data)
  //         console.log(data)
  //       })
  //       .catch((error) => console.error('Error fetching interview data:', error));
  //   }
  // }, [campaignId]);

  return (
    <PageTemplate title="Interview Session" centered maxWidth="md">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">AI Interview</h2>
        
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
            }}
            className="grid grid-rows-[1fr_auto]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left side - Audio Visualization */}
              <div className="h-[300px] flex items-center justify-center">
                <SimpleVoiceAssistant onStateChange={setAgentState} />
              </div>
              
              {/* Right side - Candidate's Webcam */}
              <div className="h-[300px] flex items-center justify-center bg-gray-100 rounded-lg">
                <CandidateVideo />
              </div>
            </div>
            
            <RemoteAudioTracks />
            <ControlBar
              onConnectButtonClicked={onConnectButtonClicked}
              agentState={agentState}
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
          participant={participant}
          volume={1.0} 
          muted={false} 
        />
      ))}
    </div>
  );
}

function CandidateVideo() {
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
      
      return () => {
        videoTrack.detach(videoEl);
        setHasTrack(false);
      };
    } else {
      setHasTrack(false);
    }
  }, [localParticipant, videoEl]);
  
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
}) {
  const { state, audioTrack } = useVoiceAssistant();
  useEffect(() => {
    props.onStateChange(state);
  }, [props, state]);
  return (
    <div className="h-[300px] w-full mx-auto flex items-center justify-center">
      <div className="w-full h-[200px] min-h-[100px] flex items-center justify-center">
        <BarVisualizer
          state={state}
          barCount={5}
          trackRef={audioTrack}
          className="w-full h-full min-h-[100px]"
          options={{
            minHeight: 24,
            barWidth: 12,
            gap: 4,
            radius: 3,
            color: '#3b82f6',
          }}
        />
      </div>
    </div>
  );
}

function ControlBar(props: {
  onConnectButtonClicked: () => void;
  agentState: AgentState;
}) {
  const krisp = useKrispNoiseFilter();
  useEffect(() => {
    krisp.setNoiseFilterEnabled(true);
  }, []);

  return (
    <div className="relative h-[100px]">
      <AnimatePresence>
        {props.agentState === "disconnected" && (
          <PrimaryButton
            initial={{ opacity: 0, top: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 1, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="mx-auto"
            onClick={() => props.onConnectButtonClicked()}
          >
            Start My Interview
          </PrimaryButton>
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
              className="flex h-8 absolute left-1/2 -translate-x-1/2  justify-center"
            >
              <RoomAudioRenderer />
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
