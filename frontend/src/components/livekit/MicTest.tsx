import React, { useState, useEffect, useRef } from 'react';

interface MicTestProps {
  onSuccess: () => void;
  showVideoToggle?: boolean;
}

const MicTest: React.FC<MicTestProps> = ({ onSuccess, showVideoToggle = false }) => {
  const [micError, setMicError] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    return () => {
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micOn]);

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-[#181A20] text-white py-12 px-4">
      <div className="w-full flex flex-col items-center mt-10">
        <h2 className="text-4xl font-bold mb-3 text-center">Activate your webcam and microphone to start the interview</h2>
        <p className="text-2xl text-gray-300 mb-12 text-center">Setup your audio and video before joining</p>
        <div className="bg-[#23242A] rounded-2xl flex flex-col items-center p-14" style={{ minWidth: 520 }}>
          <div className="flex flex-col items-center mb-10">
            {/* Large animated mic visualizer */}
            <div className="relative flex flex-col items-center justify-center mb-6">
              {/* Animated pulsing shadow when mic is working */}
              {micActive && micOn && (
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: `${260 + Math.min(120, audioLevel * 320)}px`,
                    height: `${260 + Math.min(120, audioLevel * 320)}px`,
                    background: 'rgba(130, 102, 255, 0.10)',
                    boxShadow: `0 0 ${60 + audioLevel * 120}px ${audioLevel * 1.2 + 0.3}px #8B6AFF`,
                    transition: 'width 0.1s, height 0.1s, box-shadow 0.1s',
                    zIndex: 1,
                  }}
                ></div>
              )}
              <div
                className={`w-56 h-56 rounded-full bg-[#8B6AFF] flex items-center justify-center text-7xl font-bold select-none z-10 border-8 transition-colors duration-200 ${micActive && micOn ? 'border-green-400' : 'border-[#6C4DFF]'}`}
                style={micActive && micOn ? { boxShadow: `0 0 ${30 + audioLevel * 80}px ${audioLevel * 1.0 + 0.2}px #22c55e` } : {}}
              >
                <svg width="80" height="80" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic">
                  <path d="M40 8v48M68 32a28 28 0 0 1-56 0"/>
                </svg>
              </div>
            </div>
            <div className="text-2xl text-gray-200 tracking-wide mt-4">NOOR AI</div>
          </div>
          {/* Two control buttons: mic and video */}
          <div className="flex items-center justify-center gap-8 mb-10">
            <button
              className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-colors duration-150 text-3xl ${micOn ? (micActive ? 'bg-green-700 border-green-500' : 'bg-yellow-700 border-yellow-500') : 'bg-[#23242A] border-gray-600'} text-gray-200 focus:outline-none`}
              onClick={handleMicToggle}
              aria-label={micOn ? 'Turn off microphone' : 'Turn on microphone'}
              type="button"
            >
              {micOn ? (
                <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic"><path d="M18 3v18M30 12a12 12 0 0 1-24 0"/></svg>
              ) : (
                <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic-off"><line x1="1" y1="1" x2="35" y2="35" /><path d="M18 3v8m0 8v8m0 8v4m12-14a12 12 0 0 1-24 0"/></svg>
              )}
            </button>
            {showVideoToggle && (
              <button
                className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-colors duration-150 text-3xl ${videoOn ? 'bg-blue-700 border-blue-500' : 'bg-[#23242A] border-gray-600'} text-gray-200 focus:outline-none`}
                onClick={handleVideoToggle}
                aria-label={videoOn ? 'Turn off video' : 'Turn on video'}
                type="button"
              >
                {videoOn ? (
                  <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-video"><rect x="4" y="14" width="28" height="20" rx="4" ry="4"/><polygon points="44 14 32 24 44 34 44 14"/></svg>
                ) : (
                  <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="feather feather-video-off"><path d="M34 34L4 4m30 30V14a4 4 0 0 0-4-4H14m20 20l8 8m-8-8l-8-8m0 0L4 4"/></svg>
                )}
              </button>
            )}
          </div>
          {/* Mic status and error */}
          <div className="w-full flex flex-col items-center mb-6">
            <span className={`text-2xl ${micActive && micOn ? 'text-green-400' : 'text-red-400'}`}>{micActive && micOn ? 'Microphone is working' : 'Microphone not detected'}</span>
            {micError && <span className="text-lg text-red-400 mt-3">{micError}</span>}
          </div>
          <button
            className={`rounded-xl px-12 py-5 font-semibold text-2xl mt-4 ${micActive && micOn ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' : 'bg-[#23242A] text-gray-400 cursor-not-allowed'}`}
            disabled={!(micActive && micOn)}
            onClick={onSuccess}
          >
            Continue
          </button>
        </div>
      </div>
      <div className="mb-10 text-gray-400 text-xl flex flex-col items-center">
        <span>Powered by <span className="font-bold text-blue-400">KWIKS.</span></span>
      </div>
    </div>
  );
};

export default MicTest; 
