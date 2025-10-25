'use client';

import { useState, useRef, useEffect } from 'react';

interface MicrophoneProps {
  serverUrl?: string;
  onTranscriptionUpdate?: (data: {
    original: string;
    misleading: string;
    statusMessage: string;
  }) => void;
}

interface TranscriptionResult {
  original?: string;
  misleading?: string;
  status?: string;
  message?: string;
  chunk?: string;
  error?: string;
}

export default function Microphone({ serverUrl = 'http://localhost:3001', onTranscriptionUpdate }: MicrophoneProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [originalText, setOriginalText] = useState<string>('');
  const [misleadingText, setMisleadingText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
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
      setStatusMessage('');
      setOriginalText('');
      setMisleadingText('');
      setIsProcessing(false);
      
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

      ws.onmessage = (event) => {
        try {
          const data: TranscriptionResult = JSON.parse(event.data);
          console.log('Received:', data);
          
          if (data.status === 'processing' || data.status === 'transcribing' || data.status === 'misleading') {
            setStatusMessage(data.message || '');
            if (data.original) {
              setOriginalText(data.original);
            }
            // Update parent component
            onTranscriptionUpdate?.({
              original: data.original || originalText,
              misleading: misleadingText,
              statusMessage: data.message || ''
            });
          } else if (data.status === 'streaming') {
            setMisleadingText(data.misleading || '');
            // Update parent component with streaming data
            onTranscriptionUpdate?.({
              original: originalText,
              misleading: data.misleading || '',
              statusMessage: 'Generating misleading version...'
            });
          } else if (data.status === 'complete') {
            setOriginalText(data.original || '');
            setMisleadingText(data.misleading || '');
            setStatusMessage('Complete!');
            setIsProcessing(false);
            // Update parent component with final data
            onTranscriptionUpdate?.({
              original: data.original || '',
              misleading: data.misleading || '',
              statusMessage: 'Complete!'
            });
            // Close WebSocket after receiving results
            if (websocketRef.current) {
              websocketRef.current.close();
              websocketRef.current = null;
            }
          } else if (data.status === 'error') {
            setError(data.error || 'An error occurred');
            setIsProcessing(false);
            if (websocketRef.current) {
              websocketRef.current.close();
              websocketRef.current = null;
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
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

    // Send stop signal to server before closing
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type: 'stop' }));
      setIsProcessing(true);
      setStatusMessage('Processing audio...');
      
      // Don't close the WebSocket immediately - let server send results first
      // The server will close it or we'll close it after receiving 'complete'
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
    <div className="flex flex-col items-center gap-6 p-8 bg-white rounded-lg shadow-xl max-w-md w-full">
      <h1 className="text-3xl font-bold text-gray-800">World's most reliable transcriber</h1>
      
      <button
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : isProcessing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-10 w-10 text-white" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        ) : (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-10 w-10 text-white" 
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
          {isRecording ? 'Recording...' : isProcessing ? 'Processing...' : 'Click to Start'}
        </p>
        {statusMessage && (
          <p className="text-sm text-blue-600 mt-2">
            {statusMessage}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded w-full">
          {error}
        </div>
      )}
    </div>
  );
}
