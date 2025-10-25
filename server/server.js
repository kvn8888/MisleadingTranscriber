const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  ws.on('message', (data) => {
    // Receive audio chunks from client
    console.log(`Received audio chunk: ${data.length} bytes`);
    
    // Here you can process the audio data
    // For example, send it to Azure Speech Services for transcription
    // or save it to a file, etc.
    
    // Echo back acknowledgment (optional)
    // ws.send(JSON.stringify({ status: 'received', size: data.length }));
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is ready for audio streaming`);
});
