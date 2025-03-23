import { create } from 'zustand';

interface AppState {
  isEnabled: boolean;
  toggleEnabled: () => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  isListening: boolean;
  setIsListening: (listening: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isEnabled: true,
  toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),
  isSpeaking: false,
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  isListening: false,
  setIsListening: (listening) => set({ isListening: listening }),
}));