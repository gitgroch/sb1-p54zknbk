import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the root directory
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const port = 3000;

// Configure multer for handling file uploads
// For StackBlitz, use memory storage with smaller chunk processing
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Reduce to 10MB for StackBlitz
  }
});

// Initialize OpenAI with explicit error handling
if (!process.env.VITE_OPENAI_API_KEY) {
  console.error('OpenAI API key is missing. Please check your .env file.');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
  timeout: 30000, // Reducing timeout to 30 seconds for StackBlitz
  maxRetries: 2,  // Add retries for transient errors
});

// Middleware
app.use(cors({
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 600
}));
app.use(express.json());

// Modified request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  // Add headers to prevent proxy timeouts in StackBlitz
  res.set('Connection', 'keep-alive');
  res.set('Keep-Alive', 'timeout=120');
  next();
});

// Increase the server's timeout
app.use((req, res, next) => {
  req.socket.setTimeout(120000); // 2 minutes
  next();
});

// Rate limiting
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1 second
function checkRateLimit(ip) {
  const now = Date.now();
  const lastRequest = rateLimit.get(ip) || 0;
  
  if (now - lastRequest < RATE_LIMIT_WINDOW) {
    return false;
  }
  
  rateLimit.set(ip, now);
  return true;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error occurred:', err);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Transcription endpoint optimized for StackBlitz
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!checkRateLimit(req.ip)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Transcribe endpoint called');
    console.log('Processing audio file:', {
      size: req.file.size,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname
    });

    // For StackBlitz, we'll use a FormData approach which works better
    // Create a temporary file in memory with a Buffer
    const fileBuffer = req.file.buffer;
    
    // Use direct buffer approach for OpenAI
    const response = await openai.audio.transcriptions.create({
      file: new File([fileBuffer], req.file.originalname, { type: req.file.mimetype }),
      model: 'whisper-1',
      response_format: 'json',
      temperature: 0,
      language: 'en'
    });

    if (!response || !response.text) {
      console.error('No text in response:', response);
      return res.status(500).json({ error: 'Failed to transcribe audio. No text returned.' });
    }

    console.log('Transcription completed successfully');
    res.json({ text: response.text });
  } catch (error) {
    console.error('Transcription error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      type: error.type
    });
    
    // Better error response with specific StackBlitz guidance
    let errorMessage = 'Failed to transcribe audio.';
    if (error.message.includes('socket hang up') || error.message.includes('timeout')) {
      errorMessage = 'Connection timed out. StackBlitz has limited connection timeouts for large files. Try a shorter audio clip (under 10 seconds).';
    } else if (error.message.includes('File')) {
      errorMessage = 'File handling error in StackBlitz environment. Try using the formData approach in the frontend.';
    } else if (error.status === 400) {
      errorMessage = 'Invalid audio format. Please ensure you\'re sending a supported audio format (MP3, WAV, etc.).';
    } else if (error.status === 401) {
      errorMessage = 'Authentication error. Please check your API key.';
    }

    res.status(error.status || 500).json({ error: errorMessage });
  }
});

// Speech generation endpoint optimized for StackBlitz
app.post('/api/speech', async (req, res) => {
  try {
    if (!checkRateLimit(req.ip)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }

    const { text, voice } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No text provided' });
    }

    if (text.length > 4000) {
      return res.status(400).json({ error: 'Text too long. Maximum length is 4000 characters.' });
    }

    // Use the provided voice or default to 'alloy'
    const selectedVoice = voice || 'alloy';

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: selectedVoice,
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (error) {
    console.error('Speech generation error:', error);
    
    // Better error response
    let errorMessage = 'Failed to generate speech.';
    if (error.message.includes('timeout') || error.message.includes('socket hang up')) {
      errorMessage = 'Request timed out. Consider using shorter text in StackBlitz environment.';
    }
    
    res.status(error.status || 500).json({ error: errorMessage });
  }
});

// Start server with improved error handling
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  - GET  /api/health');
  console.log('  - POST /api/transcribe');
  console.log('  - POST /api/speech');
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Try a different port.`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});