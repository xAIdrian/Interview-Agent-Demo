import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Question {
  id: number;
  question: string;
}

interface Candidate {
  email: string;
  name: string;
  position: string;
  experience: number;
  questions: {
    technical_questions: string[];
    behavioral_questions: string[];
  };
}

interface QuestionsModalProps {
  questions: Candidate['questions'];
  onClose: () => void;
}

const QuestionsModal: React.FC<QuestionsModalProps> = ({ questions, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Interview Questions</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold mb-2">Technical Questions</h4>
            <ul className="space-y-2">
              {questions.technical_questions.map((question, index) => (
                <li key={index} className="p-3 bg-gray-50 rounded">
                  <span className="font-medium">Q{index + 1}:</span> {question}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-2">Behavioral Questions</h4>
            <ul className="space-y-2">
              {questions.behavioral_questions.map((question, index) => (
                <li key={index} className="p-3 bg-gray-50 rounded">
                  <span className="font-medium">Q{index + 1}:</span> {question}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LiveKitInterviewFormProps {
  onSubmit: (name: string, token: string, roomName: string) => void;
}

export const useLiveKitInterview = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartInterview = async (name: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Starting interview for candidate:', { name });
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://interview-server-1zvi.onrender.com';
      const response = await fetch(`${apiUrl}/api/livekit/token?name=${encodeURIComponent(name)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received token data:', { token: data.token, room: data.room });
      return { token: data.token, room: data.room };
    } catch (err: any) {
      console.error('Error getting token:', err);
      setError(
        err.message || 
        'Failed to connect to the interview server. Please check if the backend is running.'
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    handleStartInterview,
    loading,
    error
  };
};

const LiveKitInterviewForm: React.FC<LiveKitInterviewFormProps> = ({ onSubmit }) => {
  const { handleStartInterview, loading, error } = useLiveKitInterview();
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { token, room } = await handleStartInterview(name);
      onSubmit(name, token, room);
    } catch (err) {
      // Error is already handled in the hook
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center p-4">{error}</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Start Interview
        </button>
      </form>
    </div>
  );
};

export default LiveKitInterviewForm; 
