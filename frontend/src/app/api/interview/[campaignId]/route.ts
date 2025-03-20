// frontend/src/app/api/interview/[campaignId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const campaignId = url.pathname.split('/').pop(); 

  try {
    const response = await axios.get(`http://127.0.0.1:5000/interview/${campaignId}`);

    console.log('🚀 ~ GET ~ response:', response);
    // Return the response data as JSON
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Error fetching interview data:', error);
    return NextResponse.json({ error: 'Failed to fetch interview data' }, { status: 500 });
  }
}
