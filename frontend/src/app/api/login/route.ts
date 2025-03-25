// frontend/src/app/api/login/route.ts
// NOTE: This route is no longer being used directly. The authentication is now handled by AuthProvider.tsx
// which makes requests directly to the backend API.

/*
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://127.0.0.1:5000';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Create request payload
    const payload = { email, password };

    // Send JSON data to Flask backend
    const response = await axios.post(`${FLASK_API_URL}/login`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // If successful, response will include JWT tokens and user data
    const { access_token, refresh_token, user } = response.data;
    
    // Create a response with the user data
    const nextResponse = NextResponse.json({
      success: true,
      message: "Login successful",
      user
    });
    
    // Set HTTP-only cookies for the tokens
    nextResponse.cookies.set({
      name: 'access_token',
      value: access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60, // 1 hour in seconds
      path: '/',
    });
    
    nextResponse.cookies.set({
      name: 'refresh_token',
      value: refresh_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: '/',
    });
    
    return nextResponse;
  } catch (error: any) {
    console.error('Login error:', error.response?.data || error.message);
    
    // Return error from Flask or a generic error message
    return NextResponse.json({ 
      success: false, 
      message: error.response?.data?.message || 'Login failed'
    }, { 
      status: error.response?.status || 500
    });
  }
}
*/

// Added a placeholder handler to avoid 404 for any lingering requests
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json({
    success: false,
    message: "This endpoint is deprecated. Authentication is now handled directly by the frontend."
  }, { status: 308 });
}
