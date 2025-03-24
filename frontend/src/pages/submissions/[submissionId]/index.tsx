import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SubmissionDetailPage: React.FC = () => {
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!submissionId) return;
      
      try {
        setIsLoading(true);
        
        // Ensure submission ID is a string
        const stringSubmissionId = String(submissionId);
        
        // Fetch submission data without authorization header
        const submissionResponse = await axios.get(`/api/submissions/${stringSubmissionId}`);
        
        // Ensure all IDs are strings
        const submissionData = submissionResponse.data;
        submissionData.id = String(submissionData.id);
        submissionData.campaign_id = String(submissionData.campaign_id);
        submissionData.user_id = String(submissionData.user_id);
        
        setSubmission(submissionData);
        
        // Fetch campaign data using campaign_id without authorization header
        const campaignResponse = await axios.get(`/api/campaigns/${String(submissionData.campaign_id)}`);
        
        // Ensure campaign ID is a string
        const campaignData = campaignResponse.data;
        campaignData.id = String(campaignData.id);
        
        setCampaign(campaignData);
        
        // Fetch submission answers without authorization header
        const answersResponse = await axios.get(`/api/submission_answers?submission_id=${stringSubmissionId}`);
        
        // Ensure all IDs in answers are strings
        const answersData = answersResponse.data.map((answer: any) => ({
          ...answer,
          id: String(answer.id),
          submission_id: String(answer.submission_id),
          question_id: String(answer.question_id)
        }));
        
        setAnswers(answersData);
        
        console.log('Successfully fetched submission data');
      } catch (error) {
        console.error('Error fetching submission data:', error);
        setError('Failed to fetch submission data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSubmission();
  }, [submissionId]);

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default SubmissionDetailPage; 