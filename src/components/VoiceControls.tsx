import React, { useEffect, useRef, useState } from 'react';
import { Mic, Speaker, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { transcribeAudio, generateSpeech } from '../services/openai';

interface VoiceControlsProps {
  type: 'input' | 'output';
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLDivElement>;
}

const MAX_RECORDING_TIME = 10; // Maximum recording time in seconds
const RATE_LIMIT_DELAY = 1000; // Minimum delay between API calls (1 second)

export const VoiceControls: React.FC<VoiceControlsProps> = ({ type, targetRef }) => {
  const { isEnabled, setIsListening, setIsSpeaking } = useAppStore();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [timeLeft, setTimeLeft] = useState(MAX_RECORDING_TIME);
  const [isProcessing, setIsProcessing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const lastApiCallRef = useRef<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio();
    }

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setError('Your browser does not support audio recording');
    }

    return () => {
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
        mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      setTimeLeft(MAX_RECORDING_TIME);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setTimeLeft(MAX_RECORDING_TIME);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    if (now - lastApiCallRef.current < RATE_LIMIT_DELAY) {
      setError('Please wait a moment before making another request.');
      return false;
    }
    lastApiCallRef.current = now;
    return true;
  };

  const requestMicrophonePermission = async () => {
    try {
      // Request permission first
      await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1,
          autoGainControl: true
        }
      });
      
      setHasPermission(true);
      setError(null);
      return stream;
    } catch (error) {
      setHasPermission(false);
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            throw new Error('Microphone access denied. Please allow microphone access in your browser settings and try again.');
          case 'NotFoundError':
            throw new Error('No microphone found. Please connect a microphone and try again.');
          case 'NotReadableError':
            throw new Error('Could not access microphone. The device may be in use by another application.');
          default:
            throw new Error('Could not access microphone. Please check your settings and try again.');
        }
      }
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      if (!checkRateLimit()) return;
      
      setError(null);
      setIsProcessing(false);
      if (targetRef.current instanceof HTMLTextAreaElement) {
        targetRef.current.value = '';
      }
      
      const stream = await requestMicrophonePermission();
      
      const options = {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      };

      mediaRecorder.current = new MediaRecorder(stream, options);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          setIsProcessing(true);
          
          const text = await transcribeAudio(audioBlob);
          
          if (targetRef.current instanceof HTMLTextAreaElement) {
            targetRef.current.value = text;
            targetRef.current.scrollTop = targetRef.current.scrollHeight;
          }
        } catch (error) {
          console.error('Transcription error:', error);
          setError(error instanceof Error ? error.message : 'Failed to transcribe audio. Please try again.');
        } finally {
          setIsProcessing(false);
          setIsListening(false);
          setIsRecording(false);
        }
      };

      mediaRecorder.current.start(1000);
      setIsListening(true);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
      setIsListening(false);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSpeechToText = () => {
    if (!isEnabled) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleTextToSpeech = async () => {
    if (!isEnabled || !audioRef.current) return;
    if (!checkRateLimit()) return;

    const text = targetRef.current instanceof HTMLDivElement 
      ? targetRef.current.textContent || ''
      : targetRef.current?.value || '';

    if (!text.trim()) {
      setError('Please enter some text to convert to speech');
      return;
    }

    try {
      setError(null);
      setIsSpeaking(true);
      setIsProcessing(true);
      const audioData = await generateSpeech(text);
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      audioRef.current.src = url;
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      
      setIsProcessing(false);
      await audioRef.current.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setError(error instanceof Error ? error.message : 'Failed to play audio. Please try again.');
      setIsSpeaking(false);
      setIsProcessing(false);
    }
  };

  if (!isEnabled) return null;

  return (
    <div className="absolute right-2 top-2">
      {error && (
        <div className="absolute bottom-full right-0 mb-2 w-64 p-2 text-sm text-red-600 bg-red-50 rounded-lg shadow-sm">
          {error}
        </div>
      )}
      <div className="flex items-center gap-2">
        {type === 'input' && isRecording && (
          <div className="text-sm font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
            {timeLeft}s
          </div>
        )}
        <button
          onClick={type === 'input' ? handleSpeechToText : handleTextToSpeech}
          className={`p-2 rounded-full transition-colors ${
            (isRecording || isEnabled) ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-gray-100'
          }`}
          title={type === 'input' ? 'Click to speak' : 'Click to listen'}
          disabled={isProcessing}
        >
          {type === 'input' ? (
            isProcessing ? (
              <Loader2 size={16} className="text-gray-600 animate-spin" />
            ) : (
              <Mic size={16} className={`${isRecording ? 'text-red-600' : 'text-gray-600'}`} />
            )
          ) : isProcessing ? (
            <Loader2 size={16} className="text-gray-600 animate-spin" />
          ) : (
            <Speaker size={16} className="text-gray-600" />
          )}
        </button>
      </div>
    </div>
  );
};