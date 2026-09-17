import React from 'react';
import { FileItem } from '../../context/DriveContext';
import { getFileRawUrl } from '../../services/api';
import { getFileCategory, isEditableFile } from '../../utils/fileTypes';

import { ImageViewer } from './ImageViewer';
import { AudioViewer } from './AudioViewer';
import { VideoViewer } from './VideoViewer';
import { TextViewer } from './TextViewer';
import { DocxViewer } from './DocxViewer';
import { ArchiveViewer } from './ArchiveViewer';
import { WebPageViewer } from './WebPageViewer';
import { OutlookMsgViewer } from './OutlookMsgViewer';
import { BinaryExeViewer } from './BinaryExeViewer';
import { XlsxViewer } from './XlsxViewer';

import { X, Download, Star, Share2, FileText, Edit3 } from 'lucide-react';

interface FileViewerModalProps {
  file: FileItem;
  onClose: () => void;
  onDownload: () => void;
  onToggleStar: () => void;
  onShare: () => void;
  onEdit?: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  file,
  onClose,
  onDownload,
  onToggleStar,
  onShare,
  onEdit,
}) => {
  const category = getFileCategory(file.name, file.mimeType);
  const fileRawUrl = getFileRawUrl(file.id);
  const editable = isEditableFile(file.name, file.mimeType);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderContent = () => {
    switch (category) {
      case 'image':
        return <ImageViewer url={fileRawUrl} filename={file.name} />;
      case 'pdf':
        return (
          <iframe
            src={fileRawUrl}
            title={file.name}
            className="w-full h-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-800"
          />
        );
      case 'video':
        return <VideoViewer url={fileRawUrl} filename={file.name} />;
      case 'audio':
        return <AudioViewer url={fileRawUrl} filename={file.name} />;
      case 'docx':
      case 'legacy_doc':
        return <DocxViewer url={fileRawUrl} filename={file.name} />;
      case 'spreadsheet':
        return <XlsxViewer url={fileRawUrl} filename={file.name} />;
      case 'web':
        return <WebPageViewer url={fileRawUrl} filename={file.name} />;
      case 'msg':
        return <OutlookMsgViewer url={fileRawUrl} filename={file.name} />;
      case 'archive':
        return <ArchiveViewer url={fileRawUrl} filename={file.name} />;
      case 'code':
      case 'csv':
      case 'text':
        return <TextViewer url={fileRawUrl} filename={file.name} isCsv={category === 'csv'} />;
      case 'binary':
        return <BinaryExeViewer url={fileRawUrl} filename={file.name} />;
      default:
        return <TextViewer url={fileRawUrl} filename={file.name} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col animate-fade-in text-slate-100">
      {/* Header */}
      <header className="h-14 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-3 truncate max-w-md">
          <FileText className="w-5 h-5 text-brand-400 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold truncate text-slate-100" title={file.name}>
              {file.name}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {formatSize(file.size)} • <span className="uppercase text-brand-400 font-bold">{file.extension || 'FILE'}</span>
            </p>
          </div>
        </div>

        {/* Global Modal Controls */}
        <div className="flex items-center gap-2">
          {editable && onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-semibold text-slate-950 transition-colors shadow-md"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit File
            </button>
          )}

          <button
            onClick={onToggleStar}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
            title="Star"
          >
            <Star className={`w-4 h-4 ${file.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
          </button>

          <button
            onClick={onShare}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 rounded-lg text-xs font-medium text-white transition-colors shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Viewer Canvas */}
      <main className="flex-1 overflow-hidden flex items-center justify-center p-4 relative">
        {renderContent()}
      </main>
    </div>
  );
};
