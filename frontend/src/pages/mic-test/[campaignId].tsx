import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const MicTestPage = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  const [name, setName] = useState('Abderrahim SAOUD');
  const [micError, setMicError] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Get access_code from query string
  const accessCode = typeof router.query.access_code === 'string' ? router.query.access_code : '';

  // Function to start mic
  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      setMicActive(true);
      setMicError('');
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const animate = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setAudioLevel(rms);
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch (err) {
      setMicError('Microphone access denied or not available. Please enable your microphone.');
      setMicActive(false);
    }
  };

  // Function to stop mic
  const stopMic = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setMicActive(false);
    setAudioLevel(0);
  };

  // Handle mic toggle
  const handleMicToggle = () => {
    if (micOn) {
      stopMic();
      setMicOn(false);
    } else {
      setMicOn(true);
      startMic();
    }
  };

  // Handle video toggle (no preview, just state)
  const handleVideoToggle = () => {
    setVideoOn(v => !v);
  };

  useEffect(() => {
    if (micOn) {
      startMic();
    } else {
      stopMic();
    }
    // Cleanup on unmount
    return () => {
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micOn]);

  const handleJoin = () => {
    if (micActive && micOn && campaignId) {
      // Navigate to the interview experience, preserving the access code
      router.push(`/live-interview/${campaignId}?access_code=${accessCode}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-[#181A20] text-white">
      <div className="w-full flex flex-col items-center mt-20">
        <h1 className="text-3xl font-bold mb-2 text-center">Activate you webcam and microphone to start the interview</h1>
        <p className="text-lg text-gray-300 mb-10 text-center">Setup your audio and video before joining</p>
        <div className="bg-[#23242A] rounded-2xl flex flex-col items-center p-10" style={{ minWidth: 420 }}>
          <div className="flex flex-col items-center mb-8">
            {/* Large animated mic visualizer */}
            <div className="relative flex flex-col items-center justify-center mb-4">
              {/* Animated pulsing shadow when mic is working */}
              {micActive && micOn && (
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: `${220 + Math.min(80, audioLevel * 220)}px`,
                    height: `${220 + Math.min(80, audioLevel * 220)}px`,
                    background: 'rgba(34,197,94,0.18)',
                    boxShadow: `0 0 ${30 + audioLevel * 60}px ${audioLevel * 0.7 + 0.2}px #22c55e`,
                    transition: 'width 0.1s, height 0.1s, box-shadow 0.1s',
                    zIndex: 1,
                  }}
                ></div>
              )}
              <div
                className={`w-44 h-44 rounded-full bg-[#8B6AFF] flex items-center justify-center text-6xl font-bold select-none z-10 border-4 transition-colors duration-200 ${micActive && micOn ? 'border-green-400' : 'border-[#6C4DFF]'}`}
                style={micActive && micOn ? { boxShadow: `0 0 ${10 + audioLevel * 40}px ${audioLevel * 0.5 + 0.1}px #22c55e` } : {}}
              >
                <svg width="48" height="48" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic">
                  <path d="M24 4v24M38 16a14 14 0 0 1-28 0"/>
                </svg>
              </div>
            </div>
            <div className="text-lg text-gray-200 tracking-wide mt-2">NOOR AI</div>
          </div>
          {/* Two control buttons: mic and video */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors duration-150 ${micOn ? (micActive ? 'bg-green-700 border-green-500' : 'bg-yellow-700 border-yellow-500') : 'bg-[#23242A] border-gray-600'} text-gray-200 focus:outline-none`}
              onClick={handleMicToggle}
              aria-label={micOn ? 'Turn off microphone' : 'Turn on microphone'}
              type="button"
            >
              {micOn ? (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic"><path d="M10 2v12M16 7a6 6 0 0 1-12 0"/></svg>
              ) : (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic-off"><line x1="1" y1="1" x2="19" y2="19" /><path d="M10 2v4m0 4v4m0 4v2m6-7a6 6 0 0 1-12 0"/></svg>
              )}
            </button>
            <button
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors duration-150 ${videoOn ? 'bg-blue-700 border-blue-500' : 'bg-[#23242A] border-gray-600'} text-gray-200 focus:outline-none`}
              onClick={handleVideoToggle}
              aria-label={videoOn ? 'Turn off video' : 'Turn on video'}
              type="button"
            >
              {videoOn ? (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-video"><rect x="2" y="7" width="15" height="10" rx="2" ry="2"/><polygon points="23 7 16 12 23 17 23 7"/></svg>
              ) : (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-video-off"><path d="M17 17L2 2m15 15V7a2 2 0 0 0-2-2H7m10 10l4 4m-4-4l-4-4m0 0L2 2"/></svg>
              )}
            </button>
          </div>
          {/* Mic status and error */}
          <div className="w-full flex flex-col items-center mb-4">
            <span className={`text-base ${micActive && micOn ? 'text-green-400' : 'text-red-400'}`}>{micActive && micOn ? 'Microphone is working' : 'Microphone not detected'}</span>
            {micError && <span className="text-sm text-red-400 mt-2">{micError}</span>}
          </div>
          <div className="flex items-center w-full mt-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 bg-[#23242A] border border-gray-600 rounded-lg px-4 py-3 text-lg text-white placeholder-gray-400 mr-4"
              placeholder="Your name"
              disabled
            />
            <button
              className={`rounded-lg px-8 py-3 font-semibold text-lg ml-2 ${micActive && micOn ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' : 'bg-[#23242A] text-gray-400 cursor-not-allowed'}`}
              disabled={!(micActive && micOn)}
              onClick={handleJoin}
            >
              Join interview
            </button>
          </div>
        </div>
      </div>
      <div className="mb-8 text-gray-400 text-sm flex flex-col items-center">
        <span>Powered by <span className="font-bold text-blue-400">KWIKS.</span></span>
      </div>
    </div>
  );
};

export default MicTestPage; 
