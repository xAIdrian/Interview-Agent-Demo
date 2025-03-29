import React, { useState } from 'react';
import axios from 'axios';

interface LiveKitInterviewFormProps {
  onSubmit: (name: string, token: string, roomName: string) => void;
}

const LiveKitInterviewForm: React.FC<LiveKitInterviewFormProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use the API URL from environment variables
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
      
      // Make a direct fetch call with minimal options to avoid CORS issues
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
      onSubmit(name, data.token, data.room);
    } catch (err: any) {
      console.error('Error getting token:', err);
      setError(
        err.message || 
        'Failed to connect to the interview server. Please check if the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-6">Start AI Interview</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        {error && (
          <div className="mb-4 text-red-500 text-sm">{error}</div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Start Interview'}
        </button>
      </form>
      
      <div className="mt-6 text-sm text-gray-600">
        <p>You'll be connected to an AI interviewer who will guide you through the interview process.</p>
      </div>
    </div>
  );
};

export default LiveKitInterviewForm; 