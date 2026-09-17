import React, { useRef, useState } from 'react';
import { Maximize2, PictureInPicture, Play, Pause } from 'lucide-react';
import { getFileExtension } from '../../utils/fileTypes';

interface VideoViewerProps {
  url: string;
  filename: string;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({ url, filename }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const ext = getFileExtension(filename);

  const togglePip = async () => {
    if (videoRef.current) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="w-full h-full max-w-5xl flex flex-col items-center justify-center relative">
      <div className="relative w-full max-h-[80vh] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center group">
        <video
          ref={videoRef}
          src={url}
          controls
          autoPlay
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="w-full h-full max-h-[80vh] object-contain"
        />

        {/* Floating Quick Action Overlay */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-700/60 p-1.5 rounded-lg text-slate-200">
          <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 font-mono font-bold text-[10px] uppercase">
            {ext}
          </span>
          <button
            onClick={togglePip}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            title="Picture in Picture"
          >
            <PictureInPicture className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
