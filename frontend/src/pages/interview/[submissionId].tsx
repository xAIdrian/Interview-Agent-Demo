"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from 'next/router';
import axios from 'axios';
import Head from 'next/head';
import { Modal } from "@/components/Modal";

// Replace the react-icons with SVG components
// SVG for closed captions icon
const CaptionsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect>
    <line x1="6" y1="12" x2="18" y2="12"></line>
    <line x1="8" y1="16" x2="16" y2="16"></line>
  </svg>
);

// SVG for phone icon
const PhoneIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);

// SVG for phone slash icon
const PhoneSlashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
    <line x1="23" y1="1" x2="1" y2="23"></line>
  </svg>
);

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Define interface for transcript entries
interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
}

// Define submission interface
interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_complete: boolean;
  total_points: number | null;
  resume_path: string | null;
  resume_text: string | null;
}

// Define campaign interface
interface Campaign {
  id: string;
  title: string;
  max_user_submissions: number;
  max_points: number;
  is_public: boolean;
  campaign_context: string;
  job_description: string;
}

export default function Page() {
  const [interviewData, setInterviewData] = useState<any>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [agentMessages, setAgentMessages] = useState<string[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [showCaptions, setShowCaptions] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { submissionId } = router.query;

  // Reference to track if interview has ended
  const interviewEndedRef = useRef(false);

  // Fetch submission data (including resume text)
  useEffect(() => {
    if (!submissionId) return;
    
    const fetchSubmissionData = async (submissionId: string) => {
      try {
        // Get the auth token
        const token = localStorage.getItem('access_token');
        
        // Ensure submissionId is a string
        const stringSubmissionId = String(submissionId);
        
        // Use the stringSubmissionId in the API call with proper authorization
        const response = await axios.get(`/api/submissions/${stringSubmissionId}`);
        
        if (response.status === 403) {
          setError('Access denied for user');
          router.push('/login');
          return null;
        }
        
        // Ensure IDs are strings
        const data = response.data;
        data.id = String(data.id);
        data.campaign_id = String(data.submission.campaign_id);
        data.user_id = String(data.submission.user_id);
        
        setSubmission(data);
        
        // If submission has resume text, share it with the interview agent
        if (data.resume_text) {
          // This could be implemented later to send resume text to agent
          console.log("Resume text available:", data.resume_text.substring(0, 100) + "...");
        }
        
        // Now fetch the campaign data using the campaign_id as a string
        return fetchCampaignData(String(data.campaign_id));
      } catch (error) {
        console.error('Error fetching submission:', error);
        setError('Failed to fetch submission data. Please try again.');
        return null;
      }
    };
    
    // Convert submissionId to string if it's an array
    const subId = Array.isArray(submissionId) ? submissionId[0] : submissionId;
    
    // Fetch submission data first, then use the campaign_id to fetch campaign data
    fetchSubmissionData(subId).then(campaignData => {
      if (campaignData) {
        fetchCampaignData(String(campaignData.id));
      }
    });
  }, [submissionId]);

  // Fetch campaign data to display position title
  const fetchCampaignData = async (campaignId: string) => {
    try {
      // Get the auth token
      const token = localStorage.getItem('access_token');
      
      // Ensure campaignId is a string
      const stringCampaignId = String(campaignId);
      
      // Use the stringCampaignId in the API call with proper authorization
      const response = await axios.get(`/api/campaigns/${stringCampaignId}`);
      
      // Ensure IDs are strings
      const data = response.data;
      data.id = String(data.id);
      
      setCampaign(data);
      return data;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      setError('Failed to fetch campaign data. Please try again.');
      return null;
    }
  };

  const startInterview = useCallback(() => {
    setInterviewStarted(true);
    
    // Mock AI messages for testing
    setTimeout(() => {
      const firstMessage = "Hello! Welcome to your interview. Could you please introduce yourself and tell me a bit about your background?";
      setAgentMessages([firstMessage]);
      setTranscript([
        {
          speaker: "AI",
          text: firstMessage,
          timestamp: Date.now() / 1000
        }
      ]);
    }, 2000);
  }, []);

  // Function to handle interview completion
  const handleInterviewComplete = useCallback(() => {
    if (interviewEndedRef.current) return;
    interviewEndedRef.current = true;
    
    console.log("Interview completed!");
    console.log("Full transcript:", transcript);
    
    // You could also save the transcript to local storage or send to server
    if (transcript.length > 0) {
      localStorage.setItem('lastInterviewTranscript', JSON.stringify(transcript));
    }
    
    // Save completed interview to API if we have a submission ID
    if (submission) {
      const completeSubmission = async () => {
        if (!submission) return;
        
        try {
          // Get the auth token
          const token = localStorage.getItem('access_token');
          
          // Ensure submissionId is a string
          const stringSubmissionId = String(submission.id);
          
          // Use the stringSubmissionId in the API call with proper authorization
          await axios.post(`/api/submissions/${stringSubmissionId}/complete`, {
            transcript: transcript
          }, {
            headers: {
              'Authorization': token ? `Bearer ${token}` : ''
            }
          });
          
          // Redirect or show completion message
          router.push('/candidate/thank-you');
        } catch (error) {
          console.error('Error completing submission:', error);
          setError('Failed to mark submission as complete. Please try again.');
        }
      };
      
      completeSubmission();
    }
  }, [transcript, router, submission]);

  // Mock function to simulate receiving a candidate response
  const handleCandidateResponse = useCallback((text: string) => {
    // Add candidate response to transcript
    setTranscript(prev => [
      ...prev,
      {
        speaker: "Candidate",
        text,
        timestamp: Date.now() / 1000
      }
    ]);
    
    // After some delay, simulate AI response
    setTimeout(() => {
      const aiResponse = "Thank you for sharing. Could you tell me about a challenging project you worked on recently?";
      
      setAgentMessages(prev => [...prev, aiResponse]);
      setTranscript(prev => [
        ...prev,
        {
          speaker: "AI",
          text: aiResponse,
          timestamp: Date.now() / 1000
        }
      ]);
    }, 3000);
  }, []);

  return (
    <>
      <Head>
        <title>{campaign?.title ? `Interview: ${campaign.title}` : 'AI Interview'} | Gulpin AI</title>
      </Head>
      <div className="w-full h-screen flex flex-col bg-gray-100">
        {/* Custom header with position title */}
        <div className="bg-white shadow-md p-4">
          <div className="max-w-screen-xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">
              {campaign ? `Interview: ${campaign.title}` : 'AI Interview'}
            </h1>
            <div className="flex space-x-4">
              <button 
                onClick={() => setShowCaptions(!showCaptions)}
                className={`p-2 rounded-full ${showCaptions ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                title="Toggle closed captions"
              >
                <CaptionsIcon />
              </button>
              <button 
                onClick={() => setShowEndModal(true)}
                className="p-2 rounded-full bg-red-100 text-red-600"
                title="End interview"
              >
                <PhoneSlashIcon />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="bg-gray-100 h-full">
            <div className="h-full flex flex-col">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {/* Left side - Audio Visualization and Messages */}
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex items-center justify-center">
                    {/* Simple audio visualizer placeholder */}
                    <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-gray-50 rounded-lg">
                      {interviewStarted ? (
                        <div className="flex space-x-2">
                          {[...Array(8)].map((_, i) => (
                            <div 
                              key={i} 
                              className="w-2 bg-blue-500 rounded-full animate-pulse"
                              style={{
                                height: `${20 + Math.random() * 40}px`,
                                animationDelay: `${i * 0.1}s`
                              }}
                            ></div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500">
                          Press "Start My Interview" to begin
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Agent Messages */}
                  <div className="mt-4 flex-grow overflow-y-auto bg-gray-50 p-4 rounded-lg shadow-inner">
                    {agentMessages.length > 0 ? (
                      <div className="text-md">
                        <strong>Current Question:</strong>
                        <p className="mt-2 text-lg">{agentMessages[agentMessages.length - 1]}</p>
                      </div>
                    ) : (
                      <div className="text-md text-gray-500 flex items-center justify-center h-full">
                        {interviewStarted ? "Waiting for the first question..." : "Connect to start the interview"}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right side - Candidate's Webcam */}
                <div className="h-full flex items-center justify-center">
                  <CandidateVideo 
                    onTrackStarted={(track) => {
                      // When video track starts, we can simulate candidate responses
                      if (interviewStarted) {
                        // For testing, simulate a response after 5 seconds
                        setTimeout(() => {
                          handleCandidateResponse("Hi there! I'm excited to be here. I have five years of experience in software development...");
                        }, 5000);
                      }
                    }}
                  />
                </div>
              </div>
              
              {/* Closed captions overlay */}
              {showCaptions && transcript.length > 0 && (
                <div className="absolute bottom-24 left-0 right-0 bg-black bg-opacity-70 text-white p-4 text-center transition-opacity duration-300">
                  {transcript[transcript.length - 1].text}
                </div>
              )}
              
              {/* Control Bar */}
              <div className="relative h-[100px] flex items-center justify-center bg-gray-50 border-t border-gray-200">
                {!interviewStarted ? (
                  <button
                    className="mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md text-lg font-medium transition-all"
                    onClick={startInterview}
                  >
                    Start My Interview
                  </button>
                ) : (
                  <div className="flex space-x-4">
                    <button
                      className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                      onClick={() => {
                        // Simulate sending a candidate response
                        handleCandidateResponse("I believe my strongest skill is problem-solving. In my previous role...");
                      }}
                    >
                      Test Response
                    </button>
                    <button
                      className="bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded-full"
                      onClick={() => setShowEndModal(true)}
                    >
                      <PhoneSlashIcon />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* End Interview Confirmation Modal */}
        {showEndModal && (
          <Modal
            isOpen={showEndModal}
            onClose={() => setShowEndModal(false)}
            title="End Interview"
          >
            <div className="p-6">
              <p className="mb-6">Are you sure you want to end this interview? This action cannot be undone.</p>
              <div className="flex justify-end space-x-4">
                <button 
                  onClick={() => setShowEndModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowEndModal(false);
                    handleInterviewComplete();
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
                >
                  <PhoneIcon className="mr-2" /> End Interview
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}

function CandidateVideo({ onTrackStarted }: { onTrackStarted?: (track: any) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let animationFrame: number;
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    
    if (!videoElement || !canvasElement) return;
    
    async function setupCamera() {
      try {
        // Request access to the user's camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        // Store stream reference for cleanup
        streamRef.current = stream;
        
        // Check if video element exists before setting properties
        if (!videoElement || !canvasElement) return;
        
        // Set the video source to the camera stream
        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
          if (!videoElement || !canvasElement) return;
          
          videoElement.play().catch(err => console.error('Error playing video:', err));
          setHasCamera(true);
          
          // Set canvas dimensions to match video
          if (videoElement.videoWidth && videoElement.videoHeight) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
          } else {
            // Default dimensions if video dimensions aren't available
            canvasElement.width = 640;
            canvasElement.height = 480;
          }
          
          // If parent component wants to know about track starting
          if (onTrackStarted) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              onTrackStarted(videoTrack);
            }
          }
          
          // Start drawing frames to canvas
          renderFrame();
        };
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Could not access camera. Please check permissions and try again.');
        setHasCamera(false);
      }
    }
    
    function renderFrame() {
      // We know videoElement and canvasElement are not null in this scope
      // but TypeScript doesn't track this through the closure
      // Use non-null assertion to prevent TS errors
      if (!videoElement || !canvasElement) return;
      
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        const ctx = canvasElement.getContext('2d');
        if (ctx) {
          // Make sure canvas dimensions match video
          const vw = videoElement.videoWidth || 640;
          const vh = videoElement.videoHeight || 480;
          
          if (canvasElement.width !== vw || canvasElement.height !== vh) {
            canvasElement.width = vw;
            canvasElement.height = vh;
          }
          
          // Draw video frame to canvas
          ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        }
      }
      
      // Schedule next frame
      animationFrame = requestAnimationFrame(renderFrame);
    }
    
    setupCamera();
    
    // Cleanup
    return () => {
      if (typeof animationFrame === 'number') {
        cancelAnimationFrame(animationFrame);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onTrackStarted]);
  
  return (
    <div className="w-full h-full relative flex items-center justify-center bg-gray-800 rounded-lg overflow-hidden">
      {/* Video element (hidden) */}
      <video 
        ref={videoRef}
        autoPlay 
        playsInline 
        muted 
        style={{ display: 'none' }}
      />
      
      {/* Canvas for displaying video */}
      {hasCamera ? (
        <canvas 
          ref={canvasRef}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-center text-white text-lg p-4">
          {error || 'Initializing camera...'}
        </div>
      )}
    </div>
  );
} 