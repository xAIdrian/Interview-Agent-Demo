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

const InstructionsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [interviewCode, setInterviewCode] = useState('');
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [codeError, setCodeError] = useState('');

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!interviewCode.trim()) {
        setCodeError('Please enter an interview code');
        return;
      }
      
      setIsValidating(true);
      setCodeError('');
      
      try {
        // Here you would validate the interview code with your backend
        // For now, we'll simulate a validation
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsCodeValid(true);
        setCurrentStep(currentStep + 1);
      } catch (error) {
        setCodeError('Invalid interview code. Please try again.');
      } finally {
        setIsValidating(false);
      }
    } else if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-blue-800 mb-3">Welcome to Your AI Interview! 🎯</h3>
            <p className="text-lg text-gray-700">
              To begin your interview, please enter the interview code provided to you:
            </p>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={interviewCode}
                  onChange={(e) => {
                    setInterviewCode(e.target.value);
                    setCodeError('');
                  }}
                  placeholder="Enter your interview code"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    codeError 
                      ? 'border-red-300 focus:ring-red-200' 
                      : 'border-gray-300 focus:ring-blue-200'
                  }`}
                />
                {isValidating && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              {codeError && (
                <p className="text-sm text-red-600">{codeError}</p>
              )}
            </div>
            <div className="bg-blue-50 p-4 rounded-lg mt-4">
              <h4 className="text-lg font-semibold text-blue-800 mb-2">Don't have an interview code?</h4>
              <p className="text-blue-700">
                If you haven't received an interview code, please contact your recruiter or the hiring team.
              </p>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-blue-800 mb-3">How the Interview Works</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-blue-800 mb-2">Interview Process:</h4>
                <ol className="space-y-3 text-blue-700 list-decimal list-inside">
                  <li>The AI interviewer will ask you a series of questions</li>
                  <li>Take your time to think and respond naturally</li>
                  <li>Your responses will be evaluated for content and clarity</li>
                  <li>The interview will last approximately 15-20 minutes</li>
                </ol>
              </div>
              <p className="text-gray-600">
                You'll see a transcript of the conversation in real-time, helping you track the discussion.
              </p>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-blue-800 mb-3">Ready to Begin?</h3>
            <div className="space-y-4">
              <p className="text-lg text-gray-700">
                You're all set to start your interview! Remember:
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <ul className="space-y-3 text-blue-700">
                  <li className="flex items-start">
                    <span className="mr-2">🎙️</span>
                    Find a quiet space where you won't be interrupted
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">💡</span>
                    Take your time to provide complete, thoughtful answers
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">🎯</span>
                    Be yourself - we want to get to know the real you!
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Step {currentStep} of {totalSteps}</h2>
        </div>
        
        {renderStepContent()}
        
        <div className="flex justify-between mt-8">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-4 py-2 rounded ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={currentStep === 1 && (isValidating || !interviewCode.trim())}
            className={`px-4 py-2 rounded ${
              currentStep === 1 && (isValidating || !interviewCode.trim())
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
          >
            {isValidating 
              ? 'Validating...' 
              : currentStep === totalSteps 
                ? 'Start Interview' 
                : 'Next'
            }
          </button>
        </div>
      </div>
    </Modal>
  );
};

const LiveKitInterviewComponent = ({ campaignId, onInterviewComplete, token, room, submissionId, onDisconnect }: LiveKitInterviewComponentProps) => {
  const livekitUrl = 'wss://default-test-oyjqa9xh.livekit.cloud';
  const [showInstructions, setShowInstructions] = useState(true);
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
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
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
    <div className="livekit-interview space-y-6">
      {showToast && (
        <Toast
          message={toastMessage}
          duration={5000}
          onClose={() => setShowToast(false)}
        />
      )}
      
      <InstructionsModal 
        isOpen={showInstructions} 
        onClose={() => setShowInstructions(false)} 
      />

      {/* Interview Interface */}
      <div className="bg-white rounded-lg overflow-hidden shadow-lg">
        <div className="p-4 bg-blue-600 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Interview Session: {user?.name}</h2>
            <button 
              onClick={() => {
                console.log('End Interview clicked', {
                  hasSubmitted,
                  isProcessingSubmission,
                  transcript,
                  submissionId
                });
                handleDisconnect();
              }}
              disabled={hasSubmitted || isProcessingSubmission}
              className={`px-3 py-1 bg-white text-blue-600 rounded transition-colors ${
                (hasSubmitted || isProcessingSubmission) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50'
              }`}
            >
              {isProcessingSubmission ? 'Processing...' : hasSubmitted ? 'Submitted' : 'End Interview'}
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <LiveKitRoom
            serverUrl={livekitUrl}
            token={token}
            connect={true}
            video={false}
            audio={true}
            onDisconnected={handleDisconnect}
          >
            <RoomAudioRenderer />
            <SimpleVoiceAssistant onTranscriptUpdate={(transcript) => handleTranscriptUpdate(false, transcript)} />
          </LiveKitRoom>
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
  );
};

export default LiveKitInterviewComponent; 
