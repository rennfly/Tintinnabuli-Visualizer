import React, { useRef, useEffect } from 'react';
import { drawOscilloscope } from '../utils';

interface OscilloscopeProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  color: string;
  backgroundColor: string;
  width: number;
  height: number;
}

const Oscilloscope: React.FC<OscilloscopeProps> = ({
  analyser,
  isPlaying,
  color,
  backgroundColor,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    const draw = () => {
      reqIdRef.current = requestAnimationFrame(draw);
      drawOscilloscope(ctx, analyser, isPlaying, color, backgroundColor, width, height);
    };

    draw();

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [analyser, isPlaying, color, backgroundColor, width, height]);

  return <canvas ref={canvasRef} className="block w-full h-full" />;
};

export default Oscilloscope;