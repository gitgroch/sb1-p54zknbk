// audioUtils.js - Add this to your project

/**
 * Records audio from the user's microphone
 * @param {number} maxDurationMs - Maximum recording duration in milliseconds (default: 10000ms)
 * @returns {Promise<Blob>} - A promise that resolves with the audio blob
 */
export async function recordAudio(maxDurationMs = 10000) {
  // For StackBlitz environment, limit recording to 10 seconds max
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create a media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm', // This format works well in most browsers
      });
      
      const audioChunks = [];
      
      // Listen for data available events
      mediaRecorder.addEventListener('dataavailable', event => {
        audioChunks.push(event.data);
      });
      
      // Set up completion handler
      mediaRecorder.addEventListener('stop', () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Create a blob from the audio chunks
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Check if the blob is not empty
        if (audioBlob.size > 0) {
          resolve(audioBlob);
        } else {
          reject(new Error('No audio data recorded'));
        }
      });
      
      // Start recording
      mediaRecorder.start();
      
      // Stop recording after the maximum duration
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, maxDurationMs);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Sends audio for transcription
 * @param {Blob} audioBlob - The audio blob to transcribe
 * @returns {Promise<string>} - A promise that resolves with the transcribed text
 */
export async function transcribeAudio(audioBlob) {
  // Create a smaller audio blob if needed
  const optimizedBlob = await optimizeAudioForTranscription(audioBlob);
  
  // Create FormData
  const formData = new FormData();
  formData.append('audio', optimizedBlob, 'recording.webm');
  
  try {
    // Set a longer timeout for the fetch request (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Transcription failed');
    }
    
    const data = await response.json();
    return data.text;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Transcription request timed out. Try a shorter recording (under 10 seconds).');
    }
    throw error;
  }
}

/**
 * Optimizes an audio blob for transcription
 * @param {Blob} audioBlob - The original audio blob
 * @returns {Promise<Blob>} - A promise that resolves with the optimized audio blob
 */
async function optimizeAudioForTranscription(audioBlob) {
  // For StackBlitz environment, we'll just check the size and return a warning if it's too large
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  
  if (audioBlob.size > MAX_SIZE) {
    console.warn(`Audio file is large (${(audioBlob.size / 1024 / 1024).toFixed(2)}MB). `+
                 `This may cause timeouts in StackBlitz. Consider recording for a shorter duration.`);
  }
  
  return audioBlob;
}

/**
 * Generates speech from text
 * @param {string} text - The text to convert to speech
 * @param {string} voice - The voice to use (default: 'alloy')
 * @returns {Promise<Blob>} - A promise that resolves with the audio blob
 */
export async function generateSpeech(text, voice = 'alloy') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch('/api/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Speech generation failed');
    }
    
    const audioBlob = await response.blob();
    return audioBlob;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Speech generation request timed out. Try shorter text.');
    }
    throw error;
  }
}

/**
 * Example usage in a React component
 * @param {string} elementId - The ID of the HTML element to type into
 * @param {string} text - The text to type
 */
export function typeIntoElement(elementId, text) {
  // Find the element
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID "${elementId}" not found`);
    return;
  }
  
  // Focus the element
  element.focus();
  
  // Set the value
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = text;
    // Dispatch input event to trigger any listeners
    element.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // For contentEditable elements
    element.innerText = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}