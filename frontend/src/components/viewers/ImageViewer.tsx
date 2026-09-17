import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, FlipHorizontal, Sliders, Maximize2 } from 'lucide-react';
import { getFileExtension } from '../../utils/fileTypes';

interface ImageViewerProps {
  url: string;
  filename: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ url, filename }) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [flipX, setFlipX] = useState<boolean>(false);
  const [filter, setFilter] = useState<'none' | 'grayscale' | 'sepia' | 'contrast' | 'invert'>('none');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const ext = getFileExtension(filename);

  const getFilterStyle = () => {
    switch (filter) {
      case 'grayscale':
        return 'grayscale(100%)';
      case 'sepia':
        return 'sepia(100%)';
      case 'contrast':
        return 'contrast(150%)';
      case 'invert':
        return 'invert(100%)';
      default:
        return 'none';
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative select-none">
      {/* Image Control Floating Bar */}
      <div className="absolute top-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-2xl text-slate-300">
        <button
          onClick={() => setZoom((z) => Math.max(25, z - 25))}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono font-medium text-slate-400 w-12 text-center">{zoom}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(400, z + 25))}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800 my-auto" />

        <button
          onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
          title="Rotate Counterclockwise"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
          title="Rotate Clockwise"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => setFlipX(!flipX)}
          className={`p-2 rounded-lg hover:bg-slate-800 ${flipX ? 'text-brand-400 bg-slate-800' : 'text-slate-300'}`}
          title="Flip Horizontal"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-800 my-auto" />

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg hover:bg-slate-800 ${showFilters ? 'text-brand-400 bg-slate-800' : 'text-slate-300'}`}
          title="Image Filters"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            setZoom(100);
            setRotation(0);
            setFlipX(false);
            setFilter('none');
          }}
          className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200"
        >
          Reset
        </button>
      </div>

      {/* Filter Selector Popup */}
      {showFilters && (
        <div className="absolute top-16 z-20 flex items-center gap-1.5 bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl text-xs">
          {(['none', 'grayscale', 'sepia', 'contrast', 'invert'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded capitalize transition-colors ${
                filter === f ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Canvas container */}
      <div className="w-full h-full flex items-center justify-center p-8 overflow-hidden">
        <img
          src={url}
          alt={filename}
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg) scaleX(${flipX ? -1 : 1})`,
            filter: getFilterStyle(),
          }}
          className="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-150 rounded shadow-2xl"
        />
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-4 z-20 px-3 py-1 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-full text-[11px] text-slate-400 font-mono">
        Format: <span className="uppercase text-slate-200 font-bold">{ext}</span> • Zoom: {zoom}%
      </div>
    </div>
  );
};
