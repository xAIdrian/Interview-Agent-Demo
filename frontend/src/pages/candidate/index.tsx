// pages/candidate/index.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PageTemplate } from '../../components/PageTemplate';

const CandidateDashboard = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await axios.get('/api/public_campaigns');
        setCampaigns(response.data);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      }
    };

    fetchCampaigns();
  }, []);

  const handleInterviewClick = (campaignId: number) => {
    router.push(`/interview/${campaignId}`);
  };

  return (
        <PageTemplate title="Available Positions" centered maxWidth="2xl">
          <div className="w-full bg-white shadow-md rounded-lg p-6">
            <h1 className="text-2xl font-bold">Available Positions</h1>
            <table className="table-auto w-full mt-4">
              <thead>
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Max Submissions</th>
                  <th className="px-4 py-2">Max Points</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="border px-4 py-2">{campaign.title}</td>
                    <td className="border px-4 py-2">{campaign.max_user_submissions}</td>
                    <td className="border px-4 py-2">{campaign.max_points}</td>
                    <td className="border px-4 py-2">
                      <button
                        className="bg-blue-500 text-white py-1 px-3 rounded"
                        onClick={() => handleInterviewClick(campaign.id)}
                      >
                        Take Interview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
    </PageTemplate>
  );
};

export default CandidateDashboard;
