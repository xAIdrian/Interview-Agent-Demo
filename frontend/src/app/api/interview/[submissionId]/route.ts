// frontend/src/app/api/interview/[submissionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const submissionId = url.pathname.split('/').pop(); 

  try {
    // First fetch the submission to get the campaign_id
    const submissionResponse = await axios.get(`http://127.0.0.1:5001/api/submissions/${submissionId}`);
    const submission = submissionResponse.data;

    // Then fetch the campaign data using the campaign_id from the submission
    const campaignResponse = await axios.get(`http://127.0.0.1:5001/api/campaigns/${submission.campaign_id}`);
    
    // Combine the data
    const interviewData = {
      submission: submission,
      campaign: campaignResponse.data
    };

    // Return the combined data as JSON
    return NextResponse.json(interviewData, { status: 200 });
  } catch (error) {
    console.error('Error fetching interview data:', error);
    return NextResponse.json({ error: 'Failed to fetch interview data' }, { status: 500 });
  }
}
