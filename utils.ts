import { NoteEvent, ThemePalette, DEFAULT_THEME } from './types';
import { Midi } from '@tonejs/midi';

// Real MIDI Parser using @tonejs/midi
export const parseMidi = (arrayBuffer: ArrayBuffer): NoteEvent[] => {
  try {
    const midi = new Midi(arrayBuffer);
    const allNotes: NoteEvent[] = [];

    midi.tracks.forEach((track, trackIndex) => {
      track.notes.forEach(note => {
        // @ts-ignore
        const noteChannel = note.channel;
        const trackChannel = track.channel;
        
        allNotes.push({
          note: note.midi,             
          velocity: note.velocity * 127,
          startTime: note.time,        
          duration: note.duration,     
          track: trackIndex,           
          channel: (typeof noteChannel === 'number') ? noteChannel : (trackChannel || 0)
        });
      });
    });
    
    return allNotes.sort((a, b) => a.startTime - b.startTime);
  } catch (error) {
    console.error("Failed to parse MIDI:", error);
    return generateMockNotes();
  }
};

export const generateMockNotes = (): NoteEvent[] => {
  const notes: NoteEvent[] = [];
  let time = 0;
  for (let i = 0; i < 200; i++) {
    const isMelody = Math.random() > 0.4;
    if (isMelody) {
       notes.push({
        note: 70 + Math.floor(Math.random() * 20),
        velocity: 90,
        startTime: time,
        duration: 0.2 + Math.random() * 0.5,
        track: 1,
        channel: 1
      });
    } else {
      notes.push({
        note: 40 + Math.floor(Math.random() * 12),
        velocity: 70,
        startTime: time,
        duration: 0.8,
        track: 0,
        channel: 0
      });
    }
    time += 0.2 + Math.random() * 0.4;
  }
  return notes;
};

// --- DRAWING FUNCTIONS ---

export const drawPianoRoll = (
  ctx: CanvasRenderingContext2D,
  notes: NoteEvent[],
  currentTime: number,
  palette: string[],
  backgroundColor: string,
  width: number,
  height: number
) => {
  ctx.save();
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const bgLum = getHexLuminance(backgroundColor);
  const isDarkBg = bgLum < 128;

  const TIME_WINDOW = 10; 
  const PX_PER_SEC = width / TIME_WINDOW;
  const MIN_NOTE = 21; 
  const MAX_NOTE = 108;
  const TOTAL_KEYS = MAX_NOTE - MIN_NOTE + 1; 
  const NOTE_HEIGHT = height / TOTAL_KEYS;
  const PLAYHEAD_X = width * 0.25;
  
  // Playhead line
  ctx.beginPath();
  ctx.moveTo(PLAYHEAD_X, 0);
  ctx.lineTo(PLAYHEAD_X, height);
  ctx.lineWidth = Math.max(2, width * 0.002); 
  ctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
  ctx.stroke();

  notes.forEach(n => {
    const relativeTime = n.startTime - currentTime;
    const x = PLAYHEAD_X + (relativeTime * PX_PER_SEC);
    const w = Math.max(n.duration * PX_PER_SEC, 3);
    const noteIndex = n.note - MIN_NOTE;
    const y = height - (noteIndex * NOTE_HEIGHT) - NOTE_HEIGHT;

    if (x + w > -100 && x < width + 100) {
      const discriminator = (n.track || 0) + (n.channel || 0);
      const colorIdx = discriminator % palette.length;
      const fillStyle = palette[colorIdx];
      const isActive = currentTime >= n.startTime && currentTime <= (n.startTime + n.duration);

      if (isActive) {
         ctx.shadowBlur = 15;
         ctx.shadowColor = fillStyle;
         ctx.fillStyle = isDarkBg ? '#ffffff' : fillStyle;
         if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(x - 1, y - 1, w + 2, NOTE_HEIGHT * 0.85 + 2, 4);
              ctx.fill();
          } else {
              ctx.fillRect(x - 1, y - 1, w + 2, NOTE_HEIGHT * 0.85 + 2);
          }
          ctx.shadowBlur = 0;
      } else {
         ctx.fillStyle = fillStyle;
         ctx.globalAlpha = 0.9; 
         ctx.shadowBlur = 4;
         ctx.shadowColor = isDarkBg ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)';
         ctx.shadowOffsetX = 2;
         ctx.shadowOffsetY = 2;
         if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(x, y, w, NOTE_HEIGHT * 0.85, 3);
              ctx.fill();
          } else {
              ctx.fillRect(x, y, w, NOTE_HEIGHT * 0.85);
          }
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
      }
    }
  });
  ctx.restore();
};

export const drawOscilloscope = (
  ctx: CanvasRenderingContext2D,
  analyser: AnalyserNode | null,
  isPlaying: boolean,
  color: string,
  backgroundColor: string,
  width: number,
  height: number
) => {
  ctx.save();
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  if (!analyser || !isPlaying) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const sliceWidth = width * 1.0 / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * height / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  ctx.restore();
};

// --- Color Helpers ---

const getHexLuminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const rgbToHex = (r: number, g: number, b: number) => 
  '#' + [r, g, b].map(x => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, '0')).join('');

const adjustColor = (hex: string, brightness: number, contrast: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const bFactor = (brightness - 100) * 1.5;
  const cFactor = (contrast / 100);

  const adjust = (val: number) => {
    let v = (val - 128) * cFactor + 128;
    v = v + bFactor;
    return v;
  };

  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
};

export const generateThemeFromImage = async (
  imgSrc: string | null, 
  brightness: number = 100, 
  contrast: number = 100
): Promise<ThemePalette> => {
  if (!imgSrc) return DEFAULT_THEME;

  try {
    const data = await getPixelData(imgSrc);
    const colorCounts: { [key: string]: number } = {};
    let maxCount = 0;
    let dominantColor = { r: 0, g: 0, b: 0 };

    for (let i = 0; i < data.length; i += 4) {
      const r = Math.round(data[i] / 10) * 10;
      const g = Math.round(data[i + 1] / 10) * 10;
      const b = Math.round(data[i + 2] / 10) * 10;
      const key = `${r},${g},${b}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
      if (colorCounts[key] > maxCount) {
        maxCount = colorCounts[key];
        dominantColor = { r: data[i], g: data[i+1], b: data[i+2] };
      }
    }

    const rawBgHex = rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b);
    const bgHex = adjustColor(rawBgHex, brightness, contrast);
    
    const potentialColors: string[] = [];
    for (let i = 0; i < data.length; i += 100) { 
      const hex = rgbToHex(data[i], data[i+1], data[i+2]);
      if (!potentialColors.includes(hex)) potentialColors.push(hex);
    }

    const bgLum = getHexLuminance(bgHex);
    const isDarkBg = bgLum < 128;
    
    const filteredTracks = potentialColors
      .map(hex => adjustColor(hex, isDarkBg ? 150 : 50, contrast)) 
      .slice(0, 5);

    if (filteredTracks.length < 2) {
      filteredTracks.push(isDarkBg ? '#ffffff' : '#000000');
    }

    return {
      background: bgHex,
      scope: filteredTracks[0],
      text: filteredTracks[0],
      tracks: filteredTracks
    };
  } catch (e) {
    console.warn("Theme extraction failed", e);
    return DEFAULT_THEME;
  }
};

const getPixelData = (imgSrc: string): Promise<Uint8ClampedArray> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject('No context'); return; }
      canvas.width = 50; canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      resolve(ctx.getImageData(0, 0, 50, 50).data);
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
};