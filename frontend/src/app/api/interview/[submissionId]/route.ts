// frontend/src/app/api/interview/[submissionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kwiks.io';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const submissionId = url.pathname.split('/').pop(); 

  try {
    // First fetch the submission to get the campaign_id
    const submissionResponse = await axios.get(`${API_URL}/api/submissions/${submissionId}`);
    const submission = submissionResponse.data;

    // Then fetch the campaign data using the campaign_id from the submission
    const campaignResponse = await axios.get(`${API_URL}/api/campaigns/${submission.campaign_id}`);
    
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
