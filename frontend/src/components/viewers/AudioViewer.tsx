import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, Repeat, RotateCcw, FastForward } from 'lucide-react';
import { getFileExtension } from '../../utils/fileTypes';

interface AudioViewerProps {
  url: string;
  filename: string;
}

export const AudioViewer: React.FC<AudioViewerProps> = ({ url, filename }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  const ext = getFileExtension(filename);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Simple spectrum bar animation
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bars = 32;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < bars; i++) {
        const height = isPlaying ? Math.random() * (canvas.height * 0.8) + 10 : 6;
        const x = i * (canvas.width / bars);
        const width = canvas.width / bars - 3;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#06b6d4');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - height, width, height);
      }
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  const changeRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col items-center">
      <audio ref={audioRef} src={url} loop={isLooping} />

      {/* Album Artwork / Icon Box */}
      <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-inner relative group">
        <Music className={`w-16 h-16 text-emerald-400 ${isPlaying ? 'animate-bounce' : ''}`} />
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/80 text-[10px] font-mono font-bold text-emerald-400 uppercase border border-emerald-500/30">
          {ext}
        </span>
      </div>

      <h3 className="text-base font-semibold text-slate-100 mb-1 text-center truncate max-w-full" title={filename}>
        {filename}
      </h3>
      <p className="text-xs text-slate-400 mb-6 font-mono uppercase">Audio Track • {ext}</p>

      {/* Spectrum Visualizer Canvas */}
      <div className="w-full h-16 bg-slate-950 rounded-xl border border-slate-800/80 p-2 mb-6 flex items-center justify-center">
        <canvas ref={canvasRef} width={380} height={48} className="w-full h-full" />
      </div>

      {/* Seek Timeline */}
      <div className="w-full flex items-center gap-3 mb-6">
        <span className="text-xs font-mono text-slate-400 w-10 text-right">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <span className="text-xs font-mono text-slate-400 w-10">{formatTime(duration)}</span>
      </div>

      {/* Controls Bar */}
      <div className="w-full flex items-center justify-between gap-4">
        {/* Playback rate */}
        <button
          onClick={changeRate}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono font-semibold transition-colors"
          title="Playback Speed"
        >
          {playbackRate}x
        </button>

        {/* Play / Pause */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10);
            }}
            className="p-2 text-slate-400 hover:text-white"
            title="Rewind 10s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="w-12 h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
          </button>
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 10);
            }}
            className="p-2 text-slate-400 hover:text-white"
            title="Forward 10s"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        {/* Loop toggle */}
        <button
          onClick={() => setIsLooping(!isLooping)}
          className={`p-2 rounded-lg transition-colors ${
            isLooping ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'
          }`}
          title="Repeat"
        >
          <Repeat className="w-4 h-4" />
        </button>
      </div>

      {/* Volume Bar */}
      <div className="w-full flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
        <button onClick={toggleMute} className="text-slate-400 hover:text-white">
          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
      </div>
    </div>
  );
};
