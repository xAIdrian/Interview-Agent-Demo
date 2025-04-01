import { NextRequest, NextResponse } from 'next/server';
import axios from '../../../utils/axios';

export async function POST(req: NextRequest) {
  try {
    // Get current access token from cookies
    const accessToken = req.cookies.get('access_token')?.value;
    
    if (accessToken) {
      // Call backend to invalidate token (if your backend supports this)
      await axios.post('/logout', {}, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }).catch(error => {
        // Even if the backend call fails, we'll clear cookies on the client side
        console.error('Error calling backend logout:', error);
      });
    }
    
    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully"
    });
    
    // Clear auth cookies
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still clear cookies even if there was an error
    const response = NextResponse.json({ 
      success: false, 
      message: 'Logout encountered an error, but cookies were cleared'
    });
    
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    
    return response;
  }
}
