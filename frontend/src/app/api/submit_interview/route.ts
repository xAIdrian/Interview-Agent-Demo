import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { transcript, submissionId } = body;

    // Log the data received
    console.log(`Received interview transcript for submission ${submissionId}:`, transcript);

    // In the future, you can add code here to:
    // 1. Save the transcript to a database with the submission ID
    // 2. Process the transcript for analysis
    // 3. Update the submission status to completed

    return NextResponse.json(
      { 
        success: true, 
        message: 'Interview submitted successfully',
        submissionId,
        timestamp: new Date().toISOString()
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in submit_interview API:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to submit interview',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 