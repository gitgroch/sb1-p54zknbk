import React, { useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { VoiceControls } from './components/VoiceControls';

function App() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textBlockRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-800">Voice Controls Demo</h1>
        
        {/* Input Demo */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Speech-to-Text Demo
          </label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              className="w-full h-32 p-4 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Click the microphone icon and start speaking..."
            />
            <VoiceControls type="input" targetRef={textareaRef} />
          </div>
        </div>

        {/* Output Demo */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Text-to-Speech Demo
          </label>
          <div className="relative">
            <div
              ref={textBlockRef}
              className="w-full p-4 pr-12 rounded-lg border border-gray-300 bg-white min-h-[100px]"
            >
              This is a sample text that can be read aloud. Click the speaker icon to hear it.
            </div>
            <VoiceControls type="output" targetRef={textBlockRef} />
          </div>
        </div>
      </div>

      <FloatingControls />
    </div>
  );
}

export default App;