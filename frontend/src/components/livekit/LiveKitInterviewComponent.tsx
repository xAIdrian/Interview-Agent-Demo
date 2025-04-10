import React from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

interface LiveKitInterviewComponentProps {
  onDisconnect: () => void;
  token: string;
  room: string;
  submissionId: string;
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

  React.useEffect(() => {
    const allMessages = [
      ...(agentTranscriptions?.map((t) => ({ ...t, type: 'agent' as const })) ?? []),
      ...(userTranscriptions?.map((t) => ({ ...t, type: 'user' as const })) ?? []),
    ].sort((a, b) => a.firstReceivedTime - b.firstReceivedTime);
    setMessages(allMessages);
    onTranscriptUpdate(allMessages);
  }, [agentTranscriptions, userTranscriptions, onTranscriptUpdate]);

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
                <p>The interviewer will ask you questions. Answer naturally as if in a real interview.</p>
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

const OnboardingModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl mx-4 shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-blue-600 mb-6">Welcome to Your AI Interview! 🎯</h2>
          
          <div className="space-y-4 text-left mb-8">
            <p className="text-lg text-gray-700">
              Before we begin, let's make sure you're set up for success:
            </p>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-xl font-semibold text-blue-800 mb-3">Quick Tips for a Great Interview:</h3>
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

            <p className="text-gray-600 italic">
              "Remember: This is your moment to shine. We're here to help you showcase your best self!"
            </p>
          </div>

          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            I'm Ready to Begin! 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

const LiveKitInterviewComponent: React.FC<LiveKitInterviewComponentProps> = ({ 
  onDisconnect, 
  token, 
  room,
  submissionId 
}) => {
  const livekitUrl = 'wss://default-test-oyjqa9xh.livekit.cloud';
  const [showOnboarding, setShowOnboarding] = React.useState(true);
  const [transcript, setTranscript] = React.useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const handleTranscriptUpdate = (newTranscript: any[]) => {
    setTranscript(newTranscript);
  };

  const handleDisconnect = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Format transcript as a string before sending
      const formattedTranscript = transcript
        .map(entry => `${entry.speaker}: ${entry.text}`)
        .join('\n');

      // Submit the transcript for scoring
      const response = await axios.post(`${API_BASE_URL}/api/submit_interview`, {
        transcript: formattedTranscript,
        submission_id: submissionId
      });

      if (response.status === 200) {
        // Success - proceed with disconnection
        onDisconnect();
      } else {
        throw new Error('Failed to submit interview for scoring');
      }
    } catch (error) {
      console.error('Error submitting interview:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit interview for scoring');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="livekit-interview">
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
      
      {/* Loading Modal */}
      <Modal 
        isOpen={isSubmitting}
        title="Submitting Interview"
      >
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="large" />
          <p className="text-gray-600 text-center">
            Please wait while we process your interview and generate your score...
          </p>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal 
        isOpen={!!submitError}
        title="Submission Error"
        onClose={() => setSubmitError(null)}
      >
        <div className="text-red-600 text-center p-4">
          {submitError}
        </div>
      </Modal>

      <div className="bg-white rounded-lg overflow-hidden shadow-lg">
        <div className="p-4 bg-blue-600 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Interview Session</h2>
            <button 
              onClick={handleDisconnect}
              className="px-3 py-1 bg-white text-blue-600 rounded hover:bg-blue-50 transition-colors"
              disabled={isSubmitting}
            >
              End Interview
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
            <SimpleVoiceAssistant onTranscriptUpdate={handleTranscriptUpdate} />
          </LiveKitRoom>
        </div>
      </div>
    </div>
  );
};

export default LiveKitInterviewComponent; 
