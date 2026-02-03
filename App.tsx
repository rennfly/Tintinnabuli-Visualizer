import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Play, Pause, Square, Settings as SettingsIcon, Timer, ZoomIn, MoveVertical, Activity } from 'lucide-react';
import { AppSettings, NoteEvent, DEFAULT_THEME, ThemePalette } from './types';
import { parseMidi, generateMockNotes, generateThemeFromImage, getHexLuminance } from './utils';
import PianoRoll from './components/PianoRoll';
import Oscilloscope from './components/Oscilloscope';

const App: React.FC = () => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [hideUI, setHideUI] = useState(false);
  
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [sourceNode, setSourceNode] = useState<AudioBufferSourceNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [startOffset, setStartOffset] = useState(0);
  
  const [notes, setNotes] = useState<NoteEvent[]>(generateMockNotes());
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [generatedTheme, setGeneratedTheme] = useState<ThemePalette>(DEFAULT_THEME);
  
  const [settings, setSettings] = useState<AppSettings>({
    title: '',
    offsetMs: 0,
    themeMode: 'normal',
    aspectRatio: '16:9',
    themeBrightness: 100,
    themeContrast: 100,
    imageZoom: 1,
    imageOffsetY: 0,
    scopeLineWidth: 2
  });

  const [showSettings, setShowSettings] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reqIdRef = useRef<number | undefined>(undefined);

  // Derive active theme
  const activeTheme = useMemo(() => {
    return settings.themeMode === 'image' ? generatedTheme : DEFAULT_THEME;
  }, [settings.themeMode, generatedTheme]);

  const isLandscape = settings.aspectRatio === '16:9';

  // Calculate UI contrast based on actual background behind the button
  const isDarkUI = useMemo(() => {
    const effectiveBg = isLandscape ? '#111111' : activeTheme.background;
    return getHexLuminance(effectiveBg) < 128;
  }, [isLandscape, activeTheme.background]);

  // Dynamically adjust title font size
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el || !settings.title) return;

    let fontSize = settings.aspectRatio === '9:16' ? 3.2 : 4.5; 
    el.style.fontSize = `${fontSize}rem`;

    const parentWidth = el.parentElement?.clientWidth || window.innerWidth;
    const tolerance = 40; 
    
    while (el.scrollWidth > parentWidth - tolerance && fontSize > 0.5) {
      fontSize -= 0.1;
      el.style.fontSize = `${fontSize}rem`;
    }
  }, [settings.title, settings.aspectRatio, showSettings]);

  // Update theme extraction
  useEffect(() => {
    if (imageSrc) {
      generateThemeFromImage(imageSrc, settings.themeBrightness, settings.themeContrast).then(setGeneratedTheme);
    }
  }, [imageSrc, settings.themeBrightness, settings.themeContrast]);

  // Init Audio Context
  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ana = ctx.createAnalyser();
    ana.fftSize = 2048;
    setAudioContext(ctx);
    setAnalyser(ana);
    return () => { ctx.close(); };
  }, []);

  const updateTime = () => {
    if (audioContext && isPlaying) {
      const now = audioContext.currentTime;
      const trackTime = (now - startTime) + startOffset;
      setCurrentTime(trackTime);
      reqIdRef.current = requestAnimationFrame(updateTime);
    }
  };

  useEffect(() => {
    if (isPlaying) reqIdRef.current = requestAnimationFrame(updateTime);
    else if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
  }, [isPlaying]);

  useEffect(() => {
    let timer: number;
    if (isCountingDown && countdown > 0) {
      timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (isCountingDown && countdown === 0) {
      setIsCountingDown(false);
      startPlayback();
    }
    return () => clearTimeout(timer);
  }, [isCountingDown, countdown]);

  const startPlayback = () => {
    if (!audioContext || !audioBuffer || !analyser) return;
    if (sourceNode) { try { sourceNode.stop(); } catch(e) {} }

    const src = audioContext.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(analyser);
    analyser.connect(audioContext.destination);
    src.start(0, startOffset);
    setSourceNode(src);
    setStartTime(audioContext.currentTime);
    setIsPlaying(true);
  };

  const handlePlayPause = async () => {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') await audioContext.resume();
    if (isPlaying) {
      if (sourceNode) sourceNode.stop();
      setStartOffset(currentTime);
      setIsPlaying(false);
    } else {
      startPlayback();
    }
  };

  const handleDelayedStart = () => {
    if (isPlaying) return;
    setCountdown(3);
    setIsCountingDown(true);
    setShowSettings(false); 
    setHideUI(true);
  };

  const handleStop = () => {
    if (sourceNode) { try { sourceNode.stop(); } catch(e) {} }
    setIsPlaying(false);
    setIsCountingDown(false);
    setStartOffset(0);
    setCurrentTime(0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setSettings(prev => ({ ...prev, themeMode: 'image', imageZoom: 1, imageOffsetY: 0 }));
    }
  };

  const dims = isLandscape 
    ? { piano: { w: 1920, h: 1080 }, scope: { w: 800, h: 600 } } 
    : { piano: { w: 1080, h: 1920 }, scope: { w: 1080, h: 600 } };

  const visualizerContainerStyle: React.CSSProperties = {
    backgroundColor: activeTheme.background,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    width: isLandscape ? '100vw' : 'calc(100vh * 9 / 16)',
    height: isLandscape ? 'calc(100vw * 9 / 16)' : '100vh',
    maxWidth: '100vw',
    maxHeight: '100vh',
  };

  const coverImageStyle: React.CSSProperties = {
    transform: `scale(${settings.imageZoom}) translateY(${settings.imageOffsetY}%)`,
    transition: 'transform 0.15s ease-out',
    objectFit: 'cover'
  };

  return (
    <div className="w-full h-screen flex items-center justify-center overflow-hidden transition-colors duration-700 bg-stone-900" style={{ backgroundColor: isLandscape ? '#111' : activeTheme.background }}>
      
      {isCountingDown && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="text-white text-9xl font-serif italic animate-pulse">{countdown}</div>
        </div>
      )}

      {/* BOUTON PARAMÈTRES ADAPTATIF AVEC ZONE REACTIVE */}
      <div 
        className="absolute top-4 right-4 z-50 w-20 h-20 flex items-center justify-center" 
        onMouseEnter={() => setHideUI(false)}
      >
         <button 
           onClick={() => setShowSettings(!showSettings)} 
           className={`p-3 rounded-full transition-all duration-500 shadow-xl hover:scale-105 active:scale-95 group ${
             isDarkUI 
               ? 'bg-white text-black hover:bg-stone-200 shadow-white/10' 
               : 'bg-black text-white hover:bg-stone-800 shadow-black/20'
           } ${hideUI ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100 pointer-events-auto'}`}
           aria-label="Settings"
         >
           <SettingsIcon size={24} strokeWidth={2} />
         </button>
      </div>

      {showSettings && (
        <div className="absolute top-16 right-4 z-50 w-80 bg-white shadow-2xl p-6 rounded-lg border border-stone-200 overflow-y-auto max-h-[85vh] font-serif custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
            <h2 className="text-xl italic mb-6 text-center border-b border-stone-300 pb-2">Settings</h2>
            
            <div className="space-y-6">
              <div className="space-y-3">
                 <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-stone-400 block mb-1">Audio</label>
                    <input type="file" accept="audio/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f && audioContext) f.arrayBuffer().then(b => audioContext.decodeAudioData(b)).then(d => { setAudioBuffer(d); handleStop(); });
                    }} className="text-[10px] w-full file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-stone-100 file:text-stone-600"/>
                 </div>
                 <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-stone-400 block mb-1">MIDI</label>
                    <input type="file" accept=".mid,.midi" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f) f.arrayBuffer().then(b => setNotes(parseMidi(b)));
                    }} className="text-[10px] w-full file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-stone-100 file:text-stone-600"/>
                 </div>
                 <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-stone-400 block mb-1">Cover Art (1:1)</label>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="text-[10px] w-full file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-stone-100 file:text-stone-600"/>
                 </div>
              </div>

              <hr className="border-stone-100"/>

              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-stone-400 block mb-1">Title</label>
                <input type="text" value={settings.title} onChange={(e) => setSettings({...settings, title: e.target.value})} placeholder="Title" className="w-full bg-transparent border-b border-stone-200 p-1 focus:outline-none font-serif text-lg text-center" />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-stone-400 block mb-2 text-center">Theme</label>
                  <div className="flex gap-2 p-1 bg-stone-100 rounded-lg">
                    <button onClick={() => setSettings({...settings, themeMode: 'normal'})} className={`flex-1 py-1 rounded-md text-xs transition-all ${settings.themeMode === 'normal' ? 'bg-white shadow-sm text-black' : 'text-stone-400'}`}>Default</button>
                    <button onClick={() => setSettings({...settings, themeMode: 'image'})} className={`flex-1 py-1 rounded-md text-xs transition-all ${settings.themeMode === 'image' ? 'bg-white shadow-sm text-black' : 'text-stone-400'}`} disabled={!imageSrc}>From Cover</button>
                  </div>
                </div>

                {settings.themeMode === 'image' && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-stone-400 block">Bright</label>
                        <input type="range" min="0" max="200" value={settings.themeBrightness} onChange={(e) => setSettings({...settings, themeBrightness: Number(e.target.value)})} className="w-full accent-stone-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-stone-400 block">Contrast</label>
                        <input type="range" min="0" max="200" value={settings.themeContrast} onChange={(e) => setSettings({...settings, themeContrast: Number(e.target.value)})} className="w-full accent-stone-800" />
                      </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t border-stone-100 pt-4">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-stone-400 block text-center mb-1">Oscilloscope Style</label>
                  <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-stone-400">
                        <Activity size={10}/> Line Width
                      </div>
                      <input type="range" min="0.5" max="10" step="0.1" value={settings.scopeLineWidth} onChange={(e) => setSettings({...settings, scopeLineWidth: Number(e.target.value)})} className="w-full accent-stone-800" />
                  </div>
              </div>

              {imageSrc && (
                <div className="space-y-4 border-t border-stone-100 pt-4">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-stone-400 block text-center mb-1">Recadrage Image</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-stone-400">
                        <ZoomIn size={10}/> Zoom
                      </div>
                      <input type="range" min="1" max="4" step="0.01" value={settings.imageZoom} onChange={(e) => setSettings({...settings, imageZoom: Number(e.target.value)})} className="w-full accent-stone-800" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-stone-400">
                        <MoveVertical size={10}/> Position Y
                      </div>
                      <input type="range" min="-50" max="50" step="0.5" value={settings.imageOffsetY} onChange={(e) => setSettings({...settings, imageOffsetY: Number(e.target.value)})} className="w-full accent-stone-800" />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-stone-400 block mb-2 text-center">Format Vidéo</label>
                <div className="flex gap-2">
                  <button onClick={() => setSettings({...settings, aspectRatio: '16:9'})} className={`flex-1 py-1 text-xs border rounded ${settings.aspectRatio === '16:9' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>16:9</button>
                  <button onClick={() => setSettings({...settings, aspectRatio: '9:16'})} className={`flex-1 py-1 text-xs border rounded ${settings.aspectRatio === '9:16' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>9:16</button>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-3 gap-2 border-t border-stone-100">
                  <button onClick={handlePlayPause} className="flex flex-col items-center justify-center p-2 hover:bg-stone-50 rounded-lg transition-colors">
                     {isPlaying ? <Pause size={18} className="text-stone-700"/> : <Play size={18} className="text-stone-700"/>}
                     <span className="text-[9px] mt-1 uppercase">Play</span>
                  </button>
                  <button onClick={handleDelayedStart} disabled={isPlaying} className="flex flex-col items-center justify-center p-2 hover:bg-stone-50 rounded-lg transition-colors disabled:opacity-20">
                     <Timer size={18} className="text-stone-700"/>
                     <span className="text-[9px] mt-1 uppercase text-center leading-tight">Start 3s</span>
                  </button>
                  <button onClick={handleStop} className="flex flex-col items-center justify-center p-2 hover:bg-stone-50 rounded-lg transition-colors">
                     <Square size={16} className="text-stone-700"/>
                     <span className="text-[9px] mt-1 uppercase">Stop</span>
                  </button>
              </div>
            </div>
        </div>
      )}

      <div className="relative shadow-2xl overflow-hidden transition-all duration-700 ease-in-out flex flex-col mx-auto" style={visualizerContainerStyle}>
        
        {/* TITRE */}
        {isLandscape ? (
          <div className="absolute top-0 w-full text-center pt-8 px-10 z-10 pointer-events-none">
            <h1 ref={titleRef} className="font-serif tracking-[0.2em] mix-blend-difference whitespace-nowrap overflow-visible" 
                style={{ color: activeTheme.text }}>
              {settings.title || 'UNTITLED'}
            </h1>
          </div>
        ) : (
          <div className="w-full text-center pt-16 pb-8 px-6 z-10 shrink-0">
             <h1 ref={titleRef} className="font-serif tracking-[0.2em] whitespace-nowrap overflow-visible leading-tight" 
                style={{ color: activeTheme.text }}>
              {settings.title || 'UNTITLED'}
            </h1>
          </div>
        )}

        {/* CONTENU PRINCIPAL */}
        {isLandscape ? (
          /* MISE EN PAGE 16/9 : Rétablie comme avant avec la grille */
          <div className="grid grid-cols-12 grid-rows-2 w-full h-full p-10 gap-6 pt-28 flex-1">
            <div className="col-span-8 row-span-2 relative overflow-hidden rounded-sm bg-black/5">
               <PianoRoll notes={notes} currentTime={currentTime + (settings.offsetMs/1000)} palette={activeTheme.tracks} backgroundColor={activeTheme.background} width={dims.piano.w} height={dims.piano.h} />
            </div>
            <div className="col-span-4 row-span-1 relative overflow-hidden rounded-sm bg-black/5">
                <Oscilloscope analyser={analyser} isPlaying={isPlaying} color={activeTheme.scope} backgroundColor={activeTheme.background} width={dims.scope.w} height={dims.scope.h} lineWidth={settings.scopeLineWidth} />
            </div>
            <div className="col-span-4 row-span-1 flex items-center justify-center overflow-hidden">
               <div className="h-full aspect-square relative overflow-hidden shadow-2xl border border-white/10 rounded-sm bg-stone-500/10">
                  {imageSrc ? (
                    <img src={imageSrc} alt="Cover" className="absolute inset-0 w-full h-full" style={coverImageStyle} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 font-serif text-2xl italic text-center px-4" style={{ color: activeTheme.text }}>COVER</div>
                  )}
               </div>
            </div>
          </div>
        ) : (
          /* MISE EN PAGE 9/16 : Optimisée plein écran sans bordures */
          <div className="flex flex-col flex-1 w-full gap-0 overflow-hidden">
             <div className="flex flex-row h-[25%] min-h-[140px] gap-0 shrink-0 justify-center">
                <div className="aspect-square h-full relative overflow-hidden bg-black/5 shrink-0 border-r border-black/5">
                    {imageSrc ? (
                      <img src={imageSrc} alt="Cover" className="absolute inset-0 w-full h-full" style={coverImageStyle} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-10 font-serif text-lg italic text-center" style={{ color: activeTheme.text }}>COVER</div>
                    )}
                </div>
                <div className="flex-1 relative overflow-hidden bg-black/5">
                     <Oscilloscope analyser={analyser} isPlaying={isPlaying} color={activeTheme.scope} backgroundColor={activeTheme.background} width={dims.scope.w} height={dims.scope.h} lineWidth={settings.scopeLineWidth} />
                </div>
             </div>
             <div className="flex-1 relative overflow-hidden bg-black/5 border-t border-black/5">
                <PianoRoll notes={notes} currentTime={currentTime + (settings.offsetMs/1000)} palette={activeTheme.tracks} backgroundColor={activeTheme.background} width={dims.piano.w} height={dims.piano.h} />
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;