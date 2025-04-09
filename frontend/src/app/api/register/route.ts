// pages/api/register.ts
// NOTE: This route is no longer being used directly. The authentication is now handled by AuthProvider.tsx
// which makes requests directly to the backend API.

/*
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    try {
      const response = await axios.post('https://main-service-48k0.onrender.com/register', req.body);
      res.status(response.status).json(response.data);
    } catch (error) {
      res.status(500).json({ error: 'Registration failed' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
*/

// Added a placeholder handler to avoid 404 for any lingering requests
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json({
    success: false,
    message: "This endpoint is deprecated. Authentication is now handled directly by the frontend."
  }, { status: 308 });
}
