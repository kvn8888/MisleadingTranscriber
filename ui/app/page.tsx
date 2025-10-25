'use client';

import { useState } from "react";
import Microphone from "@/components/Microphone";
import Results from "@/components/Results";

export default function Home() {
  const [transcriptionData, setTranscriptionData] = useState({
    original: '',
    misleading: '',
    statusMessage: '',
    backgroundImage: ''
  });

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 relative transition-all duration-1000"
      style={{ backgroundColor: '#ffeaba' }}
    >
      {/* Background image with 50% opacity */}
      {transcriptionData.backgroundImage && (
        <div 
          className="fixed inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{ 
            backgroundImage: `url(${transcriptionData.backgroundImage})`,
            opacity: 0.5,
            zIndex: 0
          }}
        />
      )}
      
      {/* Content with higher z-index */}
      <div className="relative z-10 flex flex-col items-center gap-8 w-full">
        <Microphone 
          serverUrl="http://localhost:3001"
          onTranscriptionUpdate={setTranscriptionData}
        />
        <Results 
          original={transcriptionData.original}
          misleading={transcriptionData.misleading}
          statusMessage={transcriptionData.statusMessage}
        />
      </div>
    </div>
  );
}
