import React, { useState } from 'react';
import axios from 'axios';

interface LiveKitInterviewFormProps {
  onSubmit: (token: string, roomName: string) => void;
  campaignId: string;
}

export const useLiveKitInterview = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartInterview = async (campaignId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Starting interview for campaign:', campaignId, 'and submission:');
      // const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://interview-server-1zvi.onrender.com';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';
      const response = await fetch(
        `${apiUrl}/api/livekit/token?campaignId=${encodeURIComponent(campaignId)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
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

const LiveKitInterviewForm: React.FC<LiveKitInterviewFormProps> = ({ onSubmit, campaignId }) => {
  const { handleStartInterview, loading, error } = useLiveKitInterview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { token, room } = await handleStartInterview(campaignId);
      onSubmit(token, room);
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
