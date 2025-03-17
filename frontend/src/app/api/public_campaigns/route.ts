// frontend/src/app/api/public_campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req: NextRequest) {
  try {
    // Send a GET request to the Flask server
    const response = await axios.get('http://127.0.0.1:5000/api/public_campaigns');

    // Return the response data as JSON
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Error fetching public campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch public campaigns' }, { status: 500 });
  }
}
