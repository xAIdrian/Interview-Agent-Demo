// frontend/src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Create form data
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);

    // Send form data to the Flask server
    const response = await axios.post('http://127.0.0.1:5000/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
