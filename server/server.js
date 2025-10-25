const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const Replicate = require('replicate');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/audio' });

const PORT = process.env.PORT || 3001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Transcription endpoint
app.post('/transcribe', async (req, res) => {
  try {
    const { audio_url } = req.body;
    
    if (!audio_url) {
      return res.status(400).json({ error: 'audio_url is required' });
    }

    const input = {
      audio_file: audio_url
    };

    const output = await replicate.run(
      "victor-upmeet/whisperx:84d2ad2d6194fe98a17d2b60bef1c7f910c46b2f6fd38996ca457afd9c8abfcb",
      { input }
    );

    res.json({ success: true, transcription: output });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed', message: error.message });
  }
});

// WebSocket connection handler for audio streaming
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  const sessionId = uuidv4();
  const audioChunks = [];
  let isProcessing = false;
  
  ws.on('message', async (data) => {
    // Check if it's a text message (control signal)
    if (typeof data === 'string' || data.toString().startsWith('{')) {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'stop' && !isProcessing) {
          isProcessing = true;
          await processAudio(ws, audioChunks, sessionId);
        }
      } catch (e) {
        // Not JSON, treat as audio data
        console.log(`Received audio chunk: ${data.length} bytes`);
        audioChunks.push(data);
      }
    } else {
      // Binary audio data
      console.log(`Received audio chunk: ${data.length} bytes`);
      audioChunks.push(data);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

async function processAudio(ws, audioChunks, sessionId) {
  console.log('Processing audio...');
  
  if (audioChunks.length === 0) {
    console.log('No audio data received');
    ws.send(JSON.stringify({ status: 'error', error: 'No audio data received' }));
    return;
  }

  try {
    // Send status update to client
    ws.send(JSON.stringify({ status: 'processing', message: 'Converting audio...' }));

    // Combine all audio chunks
    const audioBuffer = Buffer.concat(audioChunks);
    console.log(`Total audio size: ${audioBuffer.length} bytes`);
    
    // Save the WebM file temporarily
    const webmFilename = `${sessionId}.webm`;
    const webmPath = path.join(uploadsDir, webmFilename);
    fs.writeFileSync(webmPath, audioBuffer);
    console.log(`WebM saved to: ${webmPath}`);
    
    // Convert WebM to WAV using ffmpeg
    const wavFilename = `${sessionId}.wav`;
    const wavPath = path.join(uploadsDir, wavFilename);
    
    await new Promise((resolve, reject) => {
      ffmpeg(webmPath)
        .toFormat('wav')
        .audioFrequency(16000)
        .audioChannels(1)
        .on('end', () => {
          console.log('Conversion to WAV complete');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .save(wavPath);
    });
    
    // Read the WAV file and convert to base64
    const wavBuffer = fs.readFileSync(wavPath);
    const base64Audio = wavBuffer.toString('base64');
    const dataUri = `data:audio/wav;base64,${base64Audio}`;
    
    console.log(`WAV file size: ${wavBuffer.length} bytes`);
    
    // Send status update
    ws.send(JSON.stringify({ status: 'transcribing', message: 'Transcribing audio...' }));

    // Transcribe using Replicate with base64 data
    console.log('Starting transcription...');
    const transcriptionInput = {
      audio_file: dataUri,
      batch_size: 64,
      language: "en"
    };

    const transcriptionOutput = await replicate.run(
      "victor-upmeet/whisperx:84d2ad2d6194fe98a17d2b60bef1c7f910c46b2f6fd38996ca457afd9c8abfcb",
      { input: transcriptionInput }
    );

    console.log('Transcription complete:', JSON.stringify(transcriptionOutput, null, 2));
    
    // Extract text from transcription
    const transcriptionText = transcriptionOutput.segments
      ? transcriptionOutput.segments.map(s => s.text).join(' ')
      : '';
      
    console.log('Transcription text:', transcriptionText);

    // Send status update
    ws.send(JSON.stringify({ 
      status: 'misleading', 
      message: 'Creating misleading version...',
      original: transcriptionText 
    }));

    // Send to GPT-5 to create misleading version
    console.log('Starting GPT-5 processing...');
    let misleadingText = '';
    
    const gpt5Input = {
      prompt: transcriptionText,
      messages: [],
      verbosity: "medium",
      image_input: [],
      system_prompt: "You will convert transcriptions into a version that is intentionally opposite to what the speaker is stating. Keep the same length and style, but reverse the meaning.",
      reasoning_effort: "minimal"
    };

    for await (const event of replicate.stream("openai/gpt-5", { input: gpt5Input })) {
      const chunk = event.toString();
      misleadingText += chunk;
      
      // Stream each chunk to the client in real-time
      ws.send(JSON.stringify({ 
        status: 'streaming', 
        chunk: chunk,
        misleading: misleadingText 
      }));
    }

    console.log('GPT-5 complete:', misleadingText);

    // Send final result
    ws.send(JSON.stringify({ 
      status: 'complete',
      original: transcriptionText,
      misleading: misleadingText
    }));
    
    // Clean up files
    fs.unlinkSync(webmPath);
    fs.unlinkSync(wavPath);
    console.log('Cleaned up temporary files');
    
  } catch (error) {
    console.error('Error processing audio:', error);
    console.error('Full error:', error.message);
    
    // Send error to client
    ws.send(JSON.stringify({ 
      status: 'error',
      error: error.message 
    }));
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is ready for audio streaming`);
});
