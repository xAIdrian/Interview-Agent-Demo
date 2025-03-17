// pages/api/interview/[campaignId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { campaignId } = req.query;

  try {
    const response = await axios.get(`http://localhost:5000/interview/${campaignId}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch interview room' });
  }
};
