export interface NoteEvent {
  note: number; // MIDI note number 0-127
  velocity: number;
  startTime: number; // in seconds
  duration: number; // in seconds
  track?: number; // Track index for multi-track files
  channel?: number; // Channel for fallback differentiation
}

export type ThemeMode = 'normal' | 'image';

export interface ThemePalette {
  background: string;
  scope: string;
  tracks: string[]; // Array of colors for different tracks
  text: string;
}

export interface AppSettings {
  title: string;
  offsetMs: number;
  themeMode: ThemeMode;
  aspectRatio: '16:9' | '9:16';
  themeBrightness: number; // 0 to 200, default 100
  themeContrast: number;   // 0 to 200, default 100
  imageZoom: number;       // 1 to 3, default 1
  imageOffsetY: number;    // -50 to 50, default 0
}

export const DEFAULT_THEME: ThemePalette = {
  background: '#fffbe9', // Tintinnabuli Cream
  scope: '#1a1a1a',      // Dark scope
  text: '#1a1a1a',
  tracks: [
    '#1a1a1a', // Track 1: Black
    '#8c8c8c', // Track 2: Medium Grey
    '#4a4a4a', // Track 3: Dark Grey
    '#b0b0b0', // Track 4: Light Grey
  ]
};