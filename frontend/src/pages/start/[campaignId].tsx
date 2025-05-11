import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

const StartPage = () => {
  const [interviewCode, setInterviewCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [codeError, setCodeError] = useState('');
  const router = useRouter();
  const { campaignId } = router.query;

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 8) {
      setInterviewCode(value);
      setCodeError('');
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewCode.trim()) {
      setCodeError('Please enter an interview code');
      return;
    }
    if (interviewCode.trim().length !== 8) {
      setCodeError('Interview code must be 8 characters long');
      return;
    }
    setIsValidating(true);
    setCodeError('');
    try {
      const response = await axios.post(
        `${API_URL}/api/campaigns/${campaignId}/validate-access-code`,
        { access_code: interviewCode.trim() }
      );
      if (response.data.status === 'accepted') {
        router.push(`/live-interview/${campaignId}?access_code=${interviewCode.trim()}`);
      } else {
        setCodeError(response.data.message || 'Invalid interview code. Please try again.');
      }
    } catch (error) {
      setCodeError('Error validating code. Please try again.');
      console.error('Error validating access code:', error);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
      <form onSubmit={handleNext} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Enter your Interview code to start the interview</h2>
        <label htmlFor="interview-code" className="block text-sm font-medium text-gray-700 mb-2">
          Interview code
        </label>
        <input
          id="interview-code"
          type="text"
          value={interviewCode}
          onChange={handleCodeChange}
          placeholder="Code"
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            codeError ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
          }`}
        />
        {codeError && <p className="text-sm text-red-600 mt-2">{codeError}</p>}
        <button
          type="submit"
          disabled={isValidating || !interviewCode.trim()}
          className={`w-full mt-6 py-2 rounded-lg text-white font-semibold ${
            isValidating || !interviewCode.trim()
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isValidating ? 'Validating...' : 'Next'}
        </button>
      </form>
      <div className="mt-8 text-gray-400 text-sm flex flex-col items-center">
        <span>Powered by <span className="font-bold text-blue-600">KWIKS.</span></span>
      </div>
    </div>
  );
};

export default StartPage; 
