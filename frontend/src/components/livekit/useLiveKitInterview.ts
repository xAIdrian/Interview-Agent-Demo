import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/app/components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

interface SubmissionStatus {
  total_submissions: number;
  completed_submissions: number;
  max_submissions: number;
  can_submit: boolean;
  has_completed_submission: boolean;
}

interface ResumeUploadResponse {
  success: boolean;
  message: string;
}

export const useLiveKitInterview = (campaignId: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissionId, setSubmissionId] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const { user } = useAuth();
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    total_submissions: 0,
    completed_submissions: 0,
    max_submissions: 0,
    can_submit: true,
    has_completed_submission: false,
  });

  const uploadResume = async (file: File, submissionId: string): Promise<ResumeUploadResponse> => {
    try {
      setIsUploadingResume(true);
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('user_id', user?.id || '');
      formData.append('submission_id', submissionId);
      formData.append('position_id', campaignId);

      const response = await axios.post(`${API_URL}/api/upload_resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        success: true,
        message: 'Resume uploaded successfully'
      };
    } catch (err) {
      console.error('Error uploading resume:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to upload resume'
      };
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleStartInterview = async (campaignId: string, resumeFile?: File) => {
    try {
      setIsLoading(true);
      
      // Create submission first
      const submissionResponse = await axios.post(`${API_URL}/api/submissions`, {
        campaign_id: campaignId,
        user_id: user?.id
      });
      
      const newSubmissionId = submissionResponse.data.id;
      setSubmissionId(newSubmissionId);

      // Upload resume if provided
      if (resumeFile) {
        const uploadResult = await uploadResume(resumeFile, newSubmissionId);
        if (!uploadResult.success) {
          throw new Error(uploadResult.message);
        }
      }

      // Generate a room name based on submission ID
      const roomName = `interview-${newSubmissionId}`;
      
      // Get token from the backend
      const response = await axios.get(`${API_URL}/api/livekit/token`, {
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

        // Generate a new submission ID and token if user can submit
        if (submissions.length < (response.data.max_user_submissions || 1)) {
          const submissionResponse = await axios.post(`${API_URL}/api/submissions`, {
            campaign_id: campaignId,
            user_id: user.id
          });
          
          setSubmissionId(submissionResponse.data.submission_id);
          
          // Get token from the backend using the correct endpoint
          const tokenResponse = await axios.get(`${API_URL}/api/livekit/token`, {
            params: {
              campaignId: campaignId,
              room: `interview-${submissionResponse.data.submission_id}`
            }
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
    handleStartInterview,
    isUploadingResume,
    uploadResume
  };
}; 
