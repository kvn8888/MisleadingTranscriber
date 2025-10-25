'use client';

import { useState, useRef, useEffect } from 'react';

interface MicrophoneProps {
  serverUrl?: string;
}

export default function Microphone({ serverUrl = 'http://localhost:3001' }: MicrophoneProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      streamRef.current = stream;

      // Create WebSocket connection
      const ws = new WebSocket(`${serverUrl.replace('http', 'ws')}/audio`);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection failed');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          // Send audio chunk to server
          ws.send(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
      };

      // Start recording with chunks every 100ms
      mediaRecorder.start(100);
      setIsRecording(true);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg shadow-lg">
      <button
        onClick={toggleRecording}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 text-white" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        ) : (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-8 w-8 text-white" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        )}
      </button>
      
      <div className="text-center">
        <p className="text-lg font-semibold">
          {isRecording ? 'Recording...' : 'Click to Start'}
        </p>
        <p className="text-sm text-gray-500">
          {isRecording ? 'Streaming audio to server' : 'Ready to record'}
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
