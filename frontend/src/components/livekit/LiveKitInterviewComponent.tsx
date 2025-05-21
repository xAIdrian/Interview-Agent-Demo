import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  ControlBar,
  useVoiceAssistant,
  BarVisualizer,
  VoiceAssistantControlBar,
  useTrackTranscription,
  useLocalParticipant,
  useMaybeRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import axios from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';
import { useRouter } from 'next/router';
import { useAuth } from '@/app/components/AuthProvider';
import { Dialog } from '@headlessui/react';
import { MicrophoneIcon, PhoneXMarkIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kwiks.io';

interface SubmissionStatus {
  total_submissions: number;
  completed_submissions: number;
  max_submissions: number;
  can_submit: boolean;
  has_completed_submission: boolean;
}

interface LiveKitInterviewComponentProps {
  campaignId: string;
  onInterviewComplete: (submissionId: string) => void;
  token: string;
  room: string;
  submissionId: string;
  onDisconnect: () => void;
  candidateName: string;
  language: 'en' | 'fr';
}

interface MessageProps {
  type: 'agent' | 'user';
  text: string;
}

const Message: React.FC<MessageProps> = ({ type, text }) => {
  return (
    <div className={`message py-2 ${type === 'agent' ? 'bg-blue-50' : ''}`}>
      <strong className={`message-${type} font-medium ${type === 'agent' ? 'text-blue-600' : 'text-gray-700'}`}>
        {type === 'agent' ? 'Interviewer: ' : 'You: '}
      </strong>
      <span className="message-text">{text}</span>
    </div>
  );
};

const SimpleVoiceAssistant: React.FC<{ onTranscriptUpdate: (transcript: any[]) => void }> = ({ onTranscriptUpdate }) => {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const localParticipant = useLocalParticipant();
  const { segments: userTranscriptions } = useTrackTranscription({
    publication: localParticipant.microphoneTrack,
    source: Track.Source.Microphone,
    participant: localParticipant.localParticipant,
  });

  const [messages, setMessages] = React.useState<Array<{ id?: string; type: 'agent' | 'user'; text: string }>>([]);
  const [isWaitingForFirstResponse, setIsWaitingForFirstResponse] = useState(true);

  // Memoize the transcript update to prevent unnecessary re-renders
  const handleTranscriptUpdate = React.useCallback((newMessages: any[]) => {
    onTranscriptUpdate(newMessages);
  }, [onTranscriptUpdate]);

  React.useEffect(() => {
    const allMessages = [
      ...(agentTranscriptions?.map((t) => ({ ...t, type: 'agent' as const })) ?? []),
      ...(userTranscriptions?.map((t) => ({ ...t, type: 'user' as const })) ?? []),
    ].sort((a, b) => a.firstReceivedTime - b.firstReceivedTime);

    // Check if we've received the first agent response
    if (isWaitingForFirstResponse && agentTranscriptions && agentTranscriptions.length > 0) {
      setIsWaitingForFirstResponse(false);
    }

    // Only update if messages have actually changed
    if (JSON.stringify(allMessages) !== JSON.stringify(messages)) {
      setMessages(allMessages);
      handleTranscriptUpdate(allMessages);
    }
  }, [agentTranscriptions, userTranscriptions, messages, handleTranscriptUpdate, isWaitingForFirstResponse]);

  return (
    <div className="voice-assistant-container">
        <div className="p-4 overflow-y-auto">
          {messages.length === 0 && isWaitingForFirstResponse && (
            <div className="interview-instructions text-center bg-black text-white rounded-lg">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white"></div>
                <p>Waiting for the interviewer to begin...</p>
              </div>
            </div>
          )}
        </div>
      </div>
  );
};

const InterviewControlBar: React.FC<{
  onDisconnect: () => void;
  hasSubmitted: boolean;
  isProcessingSubmission: boolean;
}> = ({ onDisconnect, hasSubmitted, isProcessingSubmission }) => {
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const { localParticipant } = useLocalParticipant();

  // Ensure microphone starts disabled
  useEffect(() => {
    handleMicPress();
    handleMicRelease();
  }, [localParticipant]);

  const handleMicPress = async () => {
    setIsHoldingMic(true);
    setIsMicMuted(false);
    try {
      // Enable the microphone using LiveKit's built-in method
      await localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      console.log('Error enabling microphone:', err);
    }
  };

  const handleMicRelease = async () => {
    setIsHoldingMic(false);
    setIsMicMuted(true);
    try {
      // Disable the microphone using LiveKit's built-in method
      await localParticipant.setMicrophoneEnabled(false);
    } catch (err) {
      console.log('Error disabling microphone:', err);
    }
  };

  return (
    <>
    <div className="flex flex-row items-center justify-center gap-6 bg-[#23242A] rounded-xl px-8 py-4 mt-2 shadow-lg">
      {/* Mic button */}
      <div className="flex flex-col items-center gap-2">
        <button 
          className={`w-12 h-12 rounded-full ${isHoldingMic ? 'bg-green-700 border-green-500' : 'bg-[#23242A] border-gray-600'} border-2 flex items-center justify-center text-2xl text-gray-200 transition-colors duration-150 focus:outline-none`}
          onMouseDown={handleMicPress}
          onMouseUp={handleMicRelease}
          onMouseLeave={handleMicRelease}
          onTouchStart={handleMicPress}
          onTouchEnd={handleMicRelease}
        >
          <MicrophoneIcon className="w-7 h-7" />
        </button>
      </div>
      {/* Hangup button */}
      <button className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-2xl text-white hover:bg-red-700 transition-colors duration-150 focus:outline-none" onClick={onDisconnect} disabled={hasSubmitted || isProcessingSubmission}>
        <PhoneXMarkIcon className="w-7 h-7" />
      </button>
      {/* Video button (disabled for now) */}
      <button className="w-12 h-12 rounded-full bg-[#23242A] border-2 border-gray-600 flex items-center justify-center text-2xl text-gray-200 opacity-50 cursor-not-allowed">
        <VideoCameraIcon className="w-7 h-7" />
      </button>
    </div>
    <span className="text-sm text-gray-400">Hold down microphone to speak</span>
    </>
  );
};

const LiveKitInterviewComponent = ({ campaignId, onInterviewComplete, token, room, submissionId, onDisconnect, candidateName, language }: LiveKitInterviewComponentProps) => {
  const livekitUrl = 'wss://default-test-oyjqa9xh.livekit.cloud';
  const [showInstructions, setShowInstructions] = useState(true);
  const [isLivekitConnected, setIsLivekitConnected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingSubmission, setIsProcessingSubmission] = useState(false);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    total_submissions: 0,
    completed_submissions: 0,
    max_submissions: 0,
    can_submit: true,
    has_completed_submission: false,
  });
  const { user } = useAuth();
  const router = useRouter();
  const livekitRoom = useMaybeRoomContext();

  useEffect(() => {
    const fetchSubmissionStatus = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`${API_URL}/api/submissions`, {
          params: {
            campaign_id: campaignId,
            user_id: user.id
          }
        });

        const submissions = response.data;
        const completedSubmissions = submissions.filter((sub: any) => sub.is_complete).length;
        
        setSubmissionStatus({
          total_submissions: submissions.length,
          completed_submissions: completedSubmissions,
          max_submissions: response.data.max_user_submissions || 1,
          can_submit: submissions.length < (response.data.max_user_submissions || 1) && 
                     completedSubmissions < (response.data.max_user_submissions || 1),
          has_completed_submission: completedSubmissions > 0
        });

      } catch (err) {
        console.log('Error fetching submission status:', err);
        setError('Failed to load submission status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissionStatus();
  }, [campaignId, user?.id]);

  const handleTranscriptUpdate = async (submitInterview: boolean = false, newTranscript: any[]) => {
    if (!user?.id || !submissionId) {
      console.log('Missing required data:', { user_id: user?.id, submissionId });
      return;
    }

    try {
      if (submitInterview) {
        // Prevent duplicate submissions
        if (hasSubmitted) {
          console.log('Interview already submitted, skipping duplicate submission');
          return;
        }
        
        // Ensure transcript is an array and not empty
        const formattedTranscript = Array.isArray(newTranscript) ? newTranscript : [];
        if (formattedTranscript.length === 0) {
          console.log('Cannot submit interview: transcript is empty');
          setError('Cannot submit interview: no conversation recorded');
          return;
        }

        console.log('🚀 Submitting interview transcript:', {
          transcript: formattedTranscript,
          submissionId,
          campaignId,
          userId: user.id,
          transcriptLength: formattedTranscript.length
        });
        
        setIsProcessingSubmission(true);
        setHasSubmitted(true); // Mark as submitted before making the request
        
        const response = await axios.post(`${API_URL}/api/submit_interview`, {
          campaign_id: campaignId,
          user_id: user.id,
          submission_id: submissionId,
          transcript: formattedTranscript
        });

        console.log('📝 Submit interview response:', response.data);

        if (response.data.success) {
          console.log('✅ Interview submitted successfully', {
            submissionId,
            totalScore: response.data.total_score,
            maxPossibleScore: response.data.max_possible_score
          });

          // Verify the submission was marked as complete
          const verifyResponse = await axios.get(`${API_URL}/api/submissions/${submissionId}`);
          console.log('🔍 Verifying submission status:', verifyResponse.data);
          
          if (!verifyResponse.data.is_complete) {
            console.log('⚠️ Submission was not marked as complete');
            setToastMessage('Your interview was submitted but may take a few minutes to process completely.');
            setShowToast(true);
          }

          setIsProcessingSubmission(false);
          onInterviewComplete(submissionId); // Call the callback instead of redirecting
          router.push({
            pathname: '/complete',
            query: {
              campaignId,
              retakeCount: submissionStatus.max_submissions - submissionStatus.completed_submissions,
              maxAttempts: submissionStatus.max_submissions,
              isSubmitted: 'true',
            },
          });
        } else {
          console.log('❌ Interview submission failed:', response.data.error);
          setHasSubmitted(false); // Reset submission flag on failure
          throw new Error(response.data.error || 'Failed to submit interview');
        }
      } else {
        setTranscript(newTranscript);
      }
    } catch (err) {
      console.log('❌ Error submitting interview:', err);
      if (axios.isAxiosError(err)) {
        console.log('Response data:', err.response?.data);
      }
      setError('Failed to submit interview. Please try again.');
      setIsProcessingSubmission(false);
      setHasSubmitted(false); // Reset submission flag on error
    } 
  };

  const handleDisconnect = async () => {
    try {
      if (!submissionId) {
        console.log('No submissionId available for submission');
        setError('Missing submission ID');
        return;
      }

      if (hasSubmitted) {
        console.log('Interview already submitted, skipping duplicate submission');
        return;
      }

      setIsProcessingSubmission(true);
      
      // Step 1: Stop LiveKit voice/mute
      if (livekitRoom) {
        // Disable microphone first
        const localParticipant = livekitRoom.localParticipant;
        await localParticipant.setMicrophoneEnabled(false);
      }
      
      // Check if transcript is empty
      if (!transcript || transcript.length === 0) {
        setError('Cannot submit interview: no conversation recorded');
        setIsProcessingSubmission(false);
        return;
      }

      console.log('🚀 Submitting final interview transcript:', {
        transcript,
        submissionId,
        campaignId,
        transcriptLength: transcript.length
      });

      // Step 2: Submit the final transcript
      try {
        await handleTranscriptUpdate(true, transcript);
        
        // Step 3: Only disconnect and navigate after successful submission
        if (livekitRoom) {
          await livekitRoom.disconnect();
        }
        onDisconnect();
        
        // Navigation is handled in handleTranscriptUpdate after successful submission
      } catch (submitError) {
        console.log('Error submitting transcript:', submitError);
        setError('Failed to submit interview. Please try again.');
        setHasSubmitted(false);
        setIsProcessingSubmission(false);
      }
    } catch (err) {
      console.log('Error during disconnect:', err);
      setError('Failed to properly disconnect. Please try again.');
      setHasSubmitted(false);
      setIsProcessingSubmission(false);
    } 
  };

  if (isLoading) {
    return (
      <Modal 
        isOpen={true}
        onClose={() => {}}
      >
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="large" />
          <p className="text-gray-600 text-center">
            Please wait while we prepare your interview...
          </p>
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      audio={true}
      video={true}
    >
      <RoomAudioRenderer />
      <SimpleVoiceAssistant onTranscriptUpdate={(transcript) => handleTranscriptUpdate(false, transcript)} />
      <div className="min-h-screen bg-[#181A20] flex flex-col justify-center items-center py-8">
        {showToast && (
          <Toast
            message={toastMessage}
            duration={5000}
            onClose={() => setShowToast(false)}
          />
        )}
        <div className="flex flex-col items-center w-full max-w-5xl">
          {/* Tiles Row */}
          <div className="flex flex-row gap-8 w-full justify-center mb-8">
            {/* Video Tile (left) */}
            <div className="flex-1 max-w-xl bg-[#23242A] rounded-2xl border-4 border-transparent shadow-lg flex flex-col relative overflow-hidden min-h-[420px]">
              {/* Name label */}
              <div className="absolute top-4 left-4 bg-black/80 text-white text-sm px-3 py-1 rounded-full flex items-center gap-2 z-10">
                <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
                {candidateName}
              </div>
              {/* Avatar circle */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-[#6B7280] flex items-center justify-center text-6xl font-bold text-white mb-6">
                  {candidateName.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="text-2xl text-white font-semibold tracking-wide">{candidateName}</div>
              </div>
            </div>
            {/* Avatar Tile (right) */}
            <div className="flex-1 max-w-xl bg-[#23242A] rounded-2xl border-4 border-transparent shadow-lg flex flex-col relative overflow-hidden min-h-[420px]">
              {/* Name label */}
              <div className="absolute top-4 left-4 bg-black/80 text-white text-sm px-3 py-1 rounded-full flex items-center gap-2 z-10">
                <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
                NOOR AI
              </div>
              {/* Avatar circle */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-[#8B6AFF] flex items-center justify-center text-6xl font-bold text-white mb-6">
                  NA
                </div>
                <div className="text-2xl text-white font-semibold tracking-wide">NOOR AI</div>
              </div>
            </div>
          </div>
          {/* Control Bar */}
          <InterviewControlBar 
            onDisconnect={handleDisconnect}
            hasSubmitted={hasSubmitted}
            isProcessingSubmission={isProcessingSubmission}
          />
        </div>
        {/* Processing Modal */}
        <Modal 
          isOpen={isProcessingSubmission}
          onClose={() => {}}
        >
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="large" />
            <p className="text-gray-600 text-center">
              Please wait while we process your interview responses and calculate scores...
            </p>
          </div>
        </Modal>
      </div>
    </LiveKitRoom>
  );
};

export default LiveKitInterviewComponent; 
