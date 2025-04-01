// pages/api/submit_answer.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from '../../../utils/axios';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await axios.post('/api/submit_answer', body);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Error submitting answer:', error);
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 });
  }
}
