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

const SimpleVoiceAssistant: React.FC = () => {
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
  }, [agentTranscriptions, userTranscriptions]);

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

  return (
    <div className="livekit-interview">
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
      <div className="bg-white rounded-lg overflow-hidden shadow-lg">
        <div className="p-4 bg-blue-600 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Interview Session</h2>
            <button 
              onClick={onDisconnect}
              className="px-3 py-1 bg-white text-blue-600 rounded hover:bg-blue-50 transition-colors"
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
            onDisconnected={onDisconnect}
          >
            <RoomAudioRenderer />
            <SimpleVoiceAssistant />
          </LiveKitRoom>
        </div>
      </div>
    </div>
  );
};

export default LiveKitInterviewComponent; 
