'use client';

import { useState } from "react";
import Microphone from "@/components/Microphone";
import Results from "@/components/Results";

export default function Home() {
  const [transcriptionData, setTranscriptionData] = useState({
    misleading: '',
    statusMessage: ''
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8" style={{ backgroundColor: '#ffeaba' }}>
      <Microphone 
        serverUrl="http://localhost:3001"
        onTranscriptionUpdate={setTranscriptionData}
      />
      <Results 
        misleading={transcriptionData.misleading}
        statusMessage={transcriptionData.statusMessage}
      />
    </div>
  );
}
