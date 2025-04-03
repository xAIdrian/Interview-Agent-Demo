import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Question {
  id: number;
  question: string;
}

interface Candidate {
  email: string;
  name: string;
  position: string;
  experience: number;
  questions: {
    technical_questions: string[];
    behavioral_questions: string[];
  };
}

interface QuestionsModalProps {
  questions: Candidate['questions'];
  onClose: () => void;
}

const QuestionsModal: React.FC<QuestionsModalProps> = ({ questions, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Interview Questions</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold mb-2">Technical Questions</h4>
            <ul className="space-y-2">
              {questions.technical_questions.map((question, index) => (
                <li key={index} className="p-3 bg-gray-50 rounded">
                  <span className="font-medium">Q{index + 1}:</span> {question}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-2">Behavioral Questions</h4>
            <ul className="space-y-2">
              {questions.behavioral_questions.map((question, index) => (
                <li key={index} className="p-3 bg-gray-50 rounded">
                  <span className="font-medium">Q{index + 1}:</span> {question}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LiveKitInterviewFormProps {
  onSubmit: (name: string, token: string, roomName: string) => void;
}

const LiveKitInterviewForm: React.FC<LiveKitInterviewFormProps> = ({ onSubmit }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Candidate['questions'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const response = await axios.get('https://interview-server-1zvi.onrender.com/api/candidates');
        setCandidates(response.data);
      } catch (err) {
        setError('Failed to load candidates');
        console.error('Error fetching candidates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  const handleViewQuestions = (questions: Candidate['questions']) => {
    setSelectedQuestions(questions);
  };

  const handleStartInterview = async (email: string, name: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Starting interview for candidate:', { email, name });
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://interview-server-1zvi.onrender.com';
      const response = await fetch(`${apiUrl}/api/livekit/token?name=${encodeURIComponent(name)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received token data:', { token: data.token, room: data.room });
      onSubmit(name, data.token, data.room);
    } catch (err: any) {
      console.error('Error getting token:', err);
      setError(
        err.message || 
        'Failed to connect to the interview server. Please check if the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center p-4">{error}</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-6">Select Your Profile</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg overflow-hidden shadow">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {candidates.map((candidate) => (
              <tr key={candidate.email} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{candidate.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{candidate.position}</td>
                <td className="px-6 py-4 whitespace-nowrap">{candidate.experience} year(s)</td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  <button
                    onClick={() => handleViewQuestions(candidate.questions)}
                    className="px-3 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                  >
                    View Questions
                  </button>
                  <button
                    onClick={() => handleStartInterview(candidate.email, candidate.name)}
                    className="px-3 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                  >
                    Start Interview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {selectedQuestions && (
        <QuestionsModal 
          questions={selectedQuestions} 
          onClose={() => setSelectedQuestions(null)} 
        />
      )}
      
      <div className="mt-6 text-sm text-gray-600">
        <p>Select your profile to view interview questions and start the interview process.</p>
      </div>
    </div>
  );
};

export default LiveKitInterviewForm; 
