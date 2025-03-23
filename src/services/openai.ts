// API endpoints
const API_BASE_URL = '/api';

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    // First check if the server is running
    try {
      const healthCheck = await fetch(`${API_BASE_URL}/health`);
      if (!healthCheck.ok) {
        throw new Error('Server connection failed. Please ensure the server is running.');
      }
    } catch (error) {
      throw new Error('Server connection failed. Please ensure the server is running.');
    }

    // Create a new FormData instance and append the blob
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to transcribe audio');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    if (error instanceof Error && error.message === 'Failed to fetch') {
      throw new Error('Server connection failed. Please ensure the server is running.');
    }
    throw error;
  }
}

export async function generateSpeech(text: string): Promise<ArrayBuffer> {
  try {
    // First check if the server is running
    try {
      const healthCheck = await fetch(`${API_BASE_URL}/health`);
      if (!healthCheck.ok) {
        throw new Error('Server connection failed. Please ensure the server is running.');
      }
    } catch (error) {
      throw new Error('Server connection failed. Please ensure the server is running.');
    }

    const response = await fetch(`${API_BASE_URL}/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate speech');
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error generating speech:', error);
    if (error instanceof Error && error.message === 'Failed to fetch') {
      throw new Error('Server connection failed. Please ensure the server is running.');
    }
    throw error;
  }
}