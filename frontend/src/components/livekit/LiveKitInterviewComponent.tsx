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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

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
      <div className="interview-status mb-4">
        <span className="status-indicator inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
          Interview in progress
        </span>
      </div>
      <div className="visualizer-container mb-6">
        <BarVisualizer state={state} barCount={7} trackRef={audioTrack} />
      </div>
      <div className="control-section">
        <div className="mb-4">
          <VoiceAssistantControlBar />
        </div>
        <div className="conversation rounded-lg bg-white shadow overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-lg font-medium text-gray-900">Conversation</h3>
          </div>
          <div className="p-4 h-80 overflow-y-auto">
            {messages.length === 0 && (
              <div className="interview-instructions text-center py-8 text-gray-500">
                {isWaitingForFirstResponse ? (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p>Waiting for the interviewer to begin...</p>
                  </div>
                ) : (
                <p>The interviewer will ask you questions. Answer naturally as if in a real interview.</p>
                )}
              </div>
            )}
            {messages.map((msg, index) => (
              <Message key={msg.id || index} type={msg.type} text={msg.text} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const LiveKitInterviewComponent = ({ campaignId, onInterviewComplete, token, room, submissionId, onDisconnect }: LiveKitInterviewComponentProps) => {
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
        console.error('Error fetching submission status:', err);
        setError('Failed to load submission status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissionStatus();
  }, [campaignId, user?.id]);

  const handleTranscriptUpdate = async (submitInterview: boolean = false, newTranscript: any[]) => {
    if (!user?.id || !submissionId) {
      console.error('Missing required data:', { user_id: user?.id, submissionId });
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
          console.error('Cannot submit interview: transcript is empty');
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
        } else {
          console.error('❌ Interview submission failed:', response.data.error);
          setHasSubmitted(false); // Reset submission flag on failure
          throw new Error(response.data.error || 'Failed to submit interview');
        }
      } else {
        setTranscript(newTranscript);
      }
    } catch (err) {
      console.error('❌ Error submitting interview:', err);
      if (axios.isAxiosError(err)) {
        console.error('Response data:', err.response?.data);
      }
      setError('Failed to submit interview. Please try again.');
      setIsProcessingSubmission(false);
      setHasSubmitted(false); // Reset submission flag on error
    } 
  };

  const handleDisconnect = async () => {
    try {
      if (!submissionId) {
        console.error('No submissionId available for submission');
        setError('Missing submission ID');
        return;
      }

      if (hasSubmitted) {
        console.log('Interview already submitted, skipping duplicate submission');
        return;
      }

      setIsProcessingSubmission(true);
      
      // Wait a short time for any final transcriptions to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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

      // Submit the final transcript
      await handleTranscriptUpdate(true, transcript);
      
      // Call onDisconnect after successful submission
      onDisconnect();
    } catch (err) {
      console.error('Error during disconnect:', err);
      setError('Failed to properly disconnect. Please try again.');
      setHasSubmitted(false); // Reset submission flag on error
      setIsProcessingSubmission(false);
    } 
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#181A20]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400"></div>
      </div>
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
            <div className="flex-1 max-w-xl bg-[#23242A] rounded-2xl border-4 border-blue-500 shadow-lg flex flex-col relative overflow-hidden min-h-[420px]">
              {/* Name label */}
              <div className="absolute top-4 left-4 bg-black/80 text-white text-sm px-3 py-1 rounded-full flex items-center gap-2 z-10">
                <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
                Karen A
                <span className="ml-2">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 12l6 6L20 6" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </div>
              {/* Video feed placeholder (replace with actual video) */}
              <div className="flex-1 flex items-center justify-center">
                {/* LiveKit video feed would go here */}
                <div className="w-full h-full flex items-center justify-center">
                  <VideoConference />
                </div>
              </div>
              {/* Caption bar */}
              <div className="absolute bottom-0 left-0 w-full bg-black/80 text-white text-sm px-4 py-2 text-center">
                A concept on how closed captions might look on your desktop either
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
              {/* Caption bar */}
              <div className="absolute bottom-0 left-0 w-full bg-black/80 text-white text-sm px-4 py-2 text-center">
                A concept on how closed captions might look on your desktop either
              </div>
            </div>
          </div>
          {/* Control Bar */}
          <div className="flex flex-row items-center justify-center gap-6 bg-[#23242A] rounded-xl px-8 py-4 mt-2 shadow-lg">
            {/* Mic button */}
            <button className="w-12 h-12 rounded-full bg-[#23242A] border-2 border-gray-600 flex items-center justify-center text-2xl text-gray-200 hover:bg-green-700 hover:border-green-500 transition-colors duration-150 focus:outline-none">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic"><path d="M14 3v14M22 12a8 8 0 0 1-16 0"/></svg>
            </button>
            {/* Hangup button */}
            <button className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-2xl text-white hover:bg-red-700 transition-colors duration-150 focus:outline-none" onClick={handleDisconnect} disabled={hasSubmitted || isProcessingSubmission}>
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="feather feather-phone-off"><path d="M10 14l2-2 2 2m-2-2v6"/><path d="M22 16.92V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2.08a2 2 0 0 1 .84-1.63l7.11-5.33a2 2 0 0 1 2.1 0l7.11 5.33A2 2 0 0 1 22 16.92z"/></svg>
            </button>
            {/* Video button (disabled for now) */}
            <button className="w-12 h-12 rounded-full bg-[#23242A] border-2 border-gray-600 flex items-center justify-center text-2xl text-gray-200 opacity-50 cursor-not-allowed">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="feather feather-video"><rect x="4" y="8" width="20" height="12" rx="2" ry="2"/><polygon points="24 8 32 14 24 20 24 8"/></svg>
            </button>
          </div>
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
