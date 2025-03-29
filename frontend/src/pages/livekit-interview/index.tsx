import React, { useState } from 'react';
import Head from 'next/head';
import LiveKitInterviewComponent from '@/components/livekit/LiveKitInterviewComponent';
import LiveKitInterviewForm from '@/components/livekit/LiveKitInterviewForm';

const LiveKitInterviewPage = () => {
  const [token, setToken] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  
  const onFormSubmit = (name: string, token: string, roomName: string) => {
    setUserName(name);
    setToken(token);
    setRoom(roomName);
  };
  
  const onDisconnect = () => {
    setToken(null);
    setRoom(null);
  };
  
  return (
    <>
      <Head>
        <title>AI Interview | Gulpin-AI</title>
        <meta name="description" content="AI-Powered Interview Experience" />
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">AI Interview Experience</h1>
        
        {!token ? (
          <LiveKitInterviewForm onSubmit={onFormSubmit} />
        ) : (
          <LiveKitInterviewComponent 
            token={token} 
            room={room as string} 
            userName={userName}
            onDisconnect={onDisconnect}
          />
        )}
      </div>
    </>
  );
};

export default LiveKitInterviewPage; 