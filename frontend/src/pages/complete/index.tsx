import React from 'react';
import { useRouter } from 'next/router';

interface InterviewCompleteProps {
  onRetake: () => void;
  onSubmit: () => void;
  retakeCount: number;
  maxAttempts: number;
  isSubmitted: boolean;
}

const InterviewComplete: React.FC<InterviewCompleteProps> = ({ onRetake, onSubmit, retakeCount, maxAttempts, isSubmitted }) => {
  const router = useRouter();
  const { campaignId } = router.query;
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#F7F9FB]">
      <div className="bg-white rounded-xl shadow-lg p-10 flex flex-col items-center w-full max-w-md">
        <div className="mb-6">
          <img src="/folder.png" alt="Congrats" className="w-20 h-20 mx-auto" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-4">Congratulations you finished the Interview</h2>
        <div className="flex flex-row gap-4 w-full mt-4">
          <button
            className="flex-1 border border-blue-600 text-blue-600 rounded-md py-2 font-semibold hover:bg-blue-50 transition"
            onClick={() => router.push(`/live-interview?campaignId=${campaignId}`)}
            disabled={retakeCount <= 0}
          >
            Retake
          </button>
          <button
            className="flex-1 bg-blue-600 text-white rounded-md py-2 font-semibold hover:bg-blue-700 transition"
            onClick={() => window.close()}
            disabled={isSubmitted}
          >
            Submit
          </button>
        </div>
      </div>
      <footer className="mt-12 text-gray-400 text-sm">
        Powered by <span className="font-bold">KWIKS.</span>
      </footer>
    </div>
  );
};

export default InterviewComplete; 
