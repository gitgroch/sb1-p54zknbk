import React from 'react';
import { Mic, Speaker, Power } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const FloatingControls: React.FC = () => {
  const { isEnabled, toggleEnabled, isListening, isSpeaking } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-2 flex gap-2">
      <button
        onClick={toggleEnabled}
        className={`p-2 rounded-full ${
          isEnabled ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
        }`}
        title={isEnabled ? 'Disable Voice Controls' : 'Enable Voice Controls'}
      >
        <Power size={20} />
      </button>
      <div className="flex items-center gap-2 ml-2">
        <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500' : 'bg-gray-300'}`} />
        <Mic size={20} className="text-gray-600" />
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-blue-500' : 'bg-gray-300'}`} />
        <Speaker size={20} className="text-gray-600" />
      </div>
    </div>
  );
};