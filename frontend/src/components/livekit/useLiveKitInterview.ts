import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/app/components/AuthProvider';

interface SubmissionStatus {
  total_submissions: number;
  completed_submissions: number;
  max_submissions: number;
  can_submit: boolean;
  has_completed_submission: boolean;
}

export const useLiveKitInterview = (campaignId: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissionId, setSubmissionId] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const { user } = useAuth();
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    total_submissions: 0,
    completed_submissions: 0,
    max_submissions: 0,
    can_submit: true,
    has_completed_submission: false,
  });

  const handleStartInterview = async (campaignId: string) => {
    try {
      setIsLoading(true);
      // Generate a room name based on timestamp and random string
      const roomName = `interview-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Get token from the backend
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/livekit/token`, {
        params: {
          room: roomName,
          campaignId
        }
      });

      return {
        token: response.data.token,
        room: response.data.room
      };
    } catch (err) {
      console.error('Error starting interview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchSubmissionStatus = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/submissions`, {
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

        // Generate a new submission ID and token if user can submit
        if (submissions.length < (response.data.max_user_submissions || 1)) {
          const submissionResponse = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/submissions`, {
            campaign_id: campaignId,
            user_id: user.id
          });
          
          setSubmissionId(submissionResponse.data.submission_id);
          
          const tokenResponse = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/generate_token`, {
            room_name: `interview-${submissionResponse.data.submission_id}`,
            participant_name: user.name || 'Candidate'
          });
          
          setToken(tokenResponse.data.token);
        }
      } catch (err) {
        console.error('Error fetching submission status:', err);
        setError('Failed to load submission status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissionStatus();
  }, [campaignId, user?.id]);

  return {
    isLoading,
    error,
    submissionId,
    token,
    submissionStatus,
    setError,
    handleStartInterview
  };
}; 
