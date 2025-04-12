import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useAuth } from '@/app/components/AuthProvider';

interface SubmissionStatus {
  total_submissions: number;
  completed_submissions: number;
  max_submissions: number;
  can_submit: boolean;
  has_completed_submission: boolean;
}

interface LiveKitInterviewFormProps {
  campaignId: string;
  onStartInterview: () => void;
}

const LiveKitInterviewForm = ({ campaignId, onStartInterview }: LiveKitInterviewFormProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    total_submissions: 0,
    completed_submissions: 0,
    max_submissions: 0,
    can_submit: true,
    has_completed_submission: false,
  });

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
      } catch (err) {
        console.error('Error fetching submission status:', err);
        setError('Failed to load submission status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissionStatus();
  }, [campaignId, user?.id]);

  const handleStart = () => {
    if (!submissionStatus.can_submit) return;
    onStartInterview();
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
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Interview Details</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Your Application Status</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm text-gray-500">Attempts Used</p>
            <p className="text-lg font-semibold">
              {submissionStatus.total_submissions} of {submissionStatus.max_submissions}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm text-gray-500">Completed Interviews</p>
            <p className="text-lg font-semibold">{submissionStatus.completed_submissions}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <button
          onClick={handleStart}
          disabled={!submissionStatus.can_submit}
          className={`px-6 py-3 rounded-lg text-white font-semibold ${
            submissionStatus.can_submit
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {submissionStatus.can_submit ? 'Start Interview' : 'Interview Not Available'}
        </button>
        
        {!submissionStatus.can_submit && (
          <p className="mt-2 text-sm text-red-600">
            {submissionStatus.has_completed_submission 
              ? "You have already completed this interview"
              : `Maximum attempts reached (${submissionStatus.max_submissions})`}
          </p>
        )}
      </div>
    </div>
  );
};

export default LiveKitInterviewForm; 
