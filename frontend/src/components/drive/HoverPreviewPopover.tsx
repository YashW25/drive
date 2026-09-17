import React from 'react';
import { FileItem } from '../../context/DriveContext';
import { getFileRawUrl } from '../../services/api';
import { getFileCategory } from '../../utils/fileTypes';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Download,
  ExternalLink,
  Code2,
  Globe,
  Mail,
  Cpu,
  FileSpreadsheet,
} from 'lucide-react';

interface HoverPreviewProps {
  file: FileItem;
  position: { x: number; y: number };
  onOpen: () => void;
  onDownload: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const HoverPreviewPopover: React.FC<HoverPreviewProps> = ({
  file,
  position,
  onOpen,
  onDownload,
  onMouseEnter,
  onMouseLeave,
}) => {
  const category = getFileCategory(file.name, file.mimeType);
  const fileRawUrl = getFileRawUrl(file.id);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderThumbnail = () => {
    switch (category) {
      case 'image':
        return <img src={fileRawUrl} alt={file.name} className="w-full h-full object-cover" />;
      case 'video':
        return (
          <video
            src={fileRawUrl}
            className="w-full h-full object-cover"
            muted
            loop
            onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
            onMouseOut={(e) => (e.target as HTMLVideoElement).pause()}
          />
        );
      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center p-3">
            <Music className="w-10 h-10 text-emerald-400 mb-2" />
            <div className="flex items-center gap-1">
              {[30, 70, 45, 90, 60, 80, 40, 65, 35].map((h, idx) => (
                <div key={idx} className="w-1 bg-emerald-500/80 rounded-full" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        );
      case 'pdf':
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <FileText className="w-10 h-10 text-rose-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-medium">PDF Document</span>
          </div>
        );
      case 'docx':
      case 'legacy_doc':
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <FileText className="w-10 h-10 text-blue-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-medium">Word Document</span>
          </div>
        );
      case 'code':
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <Code2 className="w-10 h-10 text-purple-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-mono">Source Code File</span>
          </div>
        );
      case 'csv':
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <FileSpreadsheet className="w-10 h-10 text-emerald-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-mono">CSV Data Sheet</span>
          </div>
        );
      case 'web':
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <Globe className="w-10 h-10 text-cyan-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-medium">Web Page Document</span>
          </div>
        );
      case 'archive':
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <Archive className="w-10 h-10 text-amber-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-medium">Compressed Archive</span>
          </div>
        );
      case 'msg':
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <Mail className="w-10 h-10 text-indigo-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-medium">Outlook Message</span>
          </div>
        );
      case 'binary':
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <Cpu className="w-10 h-10 text-rose-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-mono">Binary Executable</span>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <FileText className="w-10 h-10 text-brand-400 mb-1" />
            <span className="text-[11px] text-slate-400 font-medium">Document File</span>
          </div>
        );
    }
  };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        top: Math.min(position.y, window.innerHeight - 340),
        left: Math.min(position.x + 16, window.innerWidth - 320),
      }}
      className="fixed z-50 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl p-4 text-slate-100 animate-pop-in pointer-events-auto"
    >
      {/* Preview Thumbnail Box */}
      <div className="w-full h-36 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800 relative group mb-3">
        {renderThumbnail()}
      </div>

      {/* Metadata */}
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-100 truncate mb-1" title={file.name}>
          {file.name}
        </h4>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="uppercase font-bold text-slate-300">{file.extension || 'FILE'}</span>
          <span>•</span>
          <span>{formatSize(file.size)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
        <button
          onClick={onOpen}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open
        </button>
        <button
          onClick={onDownload}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
      </div>
    </div>
  );
};
