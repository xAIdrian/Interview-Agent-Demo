// pages/api/submit_answer.ts
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    try {
      const response = await axios.post('http://127.0.0.1:5000/submit_answer', req.body);
      res.status(response.status).json(response.data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit answer' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
