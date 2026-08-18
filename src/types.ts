export type SpeedAction = 'normal' | 'speed_up_2x' | 'speed_up_4x' | 'skip';

export interface WalkthroughStep {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  action: SpeedAction;
  script: string;
  audioUrl?: string; // base64 representation or Blob URL of generated TTS
  base64Audio?: string; // Cache base64 audio from backend
  voiceName?: string; // Puck, Charon, Kore, Fenrir, Zephyr
  isGenerating?: boolean;
  error?: string;
}

export interface WalkthroughProject {
  id: string;
  videoUrl?: string; // local object URL
  videoName?: string;
  videoDuration?: number; // total duration in seconds
  brief?: string;
  steps: WalkthroughStep[];
  selectedVoice: string; // Prebuilt voice
}

export const PREBUILT_VOICES = [
  { id: 'Kore', name: 'Kore', description: 'Clear, balanced, professional (Female/Neural)' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Deep, crisp, authoritative (Male/Neural)' },
  { id: 'Puck', name: 'Puck', description: 'Cheerful, energetic, engaging (Male/Neural)' },
  { id: 'Charon', name: 'Charon', description: 'Warm, calm, narrative (Male/Neural)' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Sophisticated, steady, informative (Female/Neural)' },
];
