import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://127.0.0.1:5000';

export async function POST(req: NextRequest) {
  try {
    // Get refresh token from cookies
    const refreshToken = req.cookies.get('refresh_token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'No refresh token provided' 
      }, { status: 401 });
    }
    
    // Send refresh request to Flask backend
    const response = await axios.post(`${FLASK_API_URL}/api/refresh`, {}, {
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    });
    
    // Get new access token
    const { access_token } = response.data;
    
    // Create response with the new access token
    const nextResponse = NextResponse.json({
      success: true,
      access_token
    });
    
    // Set new access token in cookies
    nextResponse.cookies.set({
      name: 'access_token',
      value: access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    
    return nextResponse;
  } catch (error: any) {
    console.error('Token refresh error:', error.response?.data || error.message);
    
    // Return error response
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to refresh token'
    }, { 
      status: error.response?.status || 500
    });
  }
}
