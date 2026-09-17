import React, { useEffect, useState } from 'react';
import { FileItem } from '../../context/DriveContext';
import { getFileRawUrl } from '../../services/api';
import { offlineStorage } from '../../services/OfflineStorageService';
import { getFileCategory, getFileExtension, getPrismLanguage } from '../../utils/fileTypes';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Code2,
  Music,
  Video as VideoIcon,
  Archive,
  Globe,
  Mail,
  Cpu,
} from 'lucide-react';

interface FileCardPreviewProps {
  file: FileItem;
}

export const FileCardPreview: React.FC<FileCardPreviewProps> = ({ file }) => {
  const category = getFileCategory(file.name, file.mimeType);
  const ext = getFileExtension(file.name);
  const initialRawUrl = getFileRawUrl(file.id);

  const [srcUrl, setSrcUrl] = useState<string>(initialRawUrl);
  const [textSnippet, setTextSnippet] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);

  useEffect(() => {
    let isMounted = true;
    offlineStorage.getOfflineFileUrl(file.id).then((localUrl) => {
      if (isMounted && localUrl) {
        setSrcUrl(localUrl);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [file.id]);

  // For code/text files, fetch the first few lines to display a live code snippet preview in the card
  useEffect(() => {
    if (category === 'code' || category === 'text' || category === 'web' || category === 'csv') {
      let isMounted = true;
      fetch(srcUrl)
        .then((res) => res.text())
        .then((text) => {
          if (!isMounted) return;
          if (category === 'csv' || ext === 'csv') {
            const rows = text
              .slice(0, 1000)
              .trim()
              .split('\n')
              .slice(0, 3)
              .map((r) => r.split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1')));
            setCsvRows(rows);
          } else {
            // First 5 lines for snippet
            const snippet = text.split('\n').slice(0, 5).join('\n');
            setTextSnippet(snippet);
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }
  }, [file.id, category, ext, srcUrl]);

  // 1. Image Formats
  if (category === 'image') {
    return (
      <img
        src={srcUrl}
        alt={file.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
      />
    );
  }

  // 2. Video Formats
  if (category === 'video') {
    return (
      <div className="w-full h-full relative overflow-hidden bg-slate-950 flex items-center justify-center">
        <video
          src={srcUrl}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
        />
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div className="p-2 bg-indigo-500/80 rounded-full text-white shadow-lg">
            <VideoIcon className="w-5 h-5 fill-current" />
          </div>
        </div>
      </div>
    );
  }

  // 3. Audio Formats
  if (category === 'audio') {
    return (
      <div className="w-full h-full bg-gradient-to-br from-emerald-950/80 to-slate-950 p-3 flex flex-col justify-between select-none">
        <div className="flex items-center justify-between text-xs">
          <Music className="w-5 h-5 text-emerald-400" />
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[9px] uppercase">
            {ext}
          </span>
        </div>
        <div className="flex items-end justify-center gap-1 h-10 px-2">
          {[45, 80, 55, 95, 70, 60, 85, 40, 75, 65, 90, 50].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-emerald-500/70 rounded-full group-hover:bg-emerald-400 transition-colors"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="text-[10px] font-mono text-slate-400 truncate">Audio Stream</div>
      </div>
    );
  }

  // 4. CSV & Spreadsheet Formats
  if (category === 'csv' || category === 'spreadsheet') {
    return (
      <div className="w-full h-full bg-slate-950 p-2.5 flex flex-col justify-between select-none font-mono text-[10px]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="uppercase text-[9px]">{ext} SHEET</span>
          </div>
        </div>
        {csvRows && csvRows.length > 0 ? (
          <div className="flex-1 overflow-hidden border border-slate-800 rounded bg-slate-900/60 p-1 text-[9px] leading-tight text-slate-300">
            <table className="w-full text-left">
              <tbody>
                {csvRows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/40">
                    {r.slice(0, 3).map((cell, cIdx) => (
                      <td key={cIdx} className="p-0.5 truncate max-w-[60px]">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded text-slate-500">
            <FileSpreadsheet className="w-6 h-6 text-emerald-500/60 mb-1" />
            <span>Grid Data</span>
          </div>
        )}
      </div>
    );
  }

  // 5. Code & Text Files Snippet Preview
  if (category === 'code' || category === 'text' || category === 'web') {
    const lang = getPrismLanguage(file.name);
    return (
      <div className="w-full h-full bg-[#1e1e1e] p-2.5 flex flex-col justify-between font-mono text-[9px] select-none text-slate-300 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
          <div className="flex items-center gap-1.5 text-purple-400 font-bold">
            <Code2 className="w-3.5 h-3.5" />
            <span className="uppercase text-[9px]">{ext}</span>
          </div>
          <span className="text-[9px] text-slate-500">{lang}</span>
        </div>
        {textSnippet ? (
          <div className="flex-1 overflow-hidden bg-slate-950/60 p-1.5 rounded border border-slate-800 text-slate-300 whitespace-pre leading-tight font-mono text-[9px] opacity-90 group-hover:opacity-100">
            {textSnippet}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
            <Code2 className="w-6 h-6 opacity-40" />
          </div>
        )}
      </div>
    );
  }

  // 6. Presentation Formats
  if (category === 'presentation') {
    return (
      <div className="w-full h-full bg-gradient-to-br from-amber-950/60 to-slate-950 p-3 flex flex-col justify-between select-none">
        <div className="flex items-center justify-between text-xs">
          <Presentation className="w-5 h-5 text-amber-400" />
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold text-[9px] uppercase">
            {ext}
          </span>
        </div>
        <div className="w-full h-12 bg-slate-900 border border-slate-800 rounded p-2 flex flex-col justify-center items-center text-center">
          <div className="w-3/4 h-1.5 bg-amber-400/60 rounded mb-1" />
          <div className="w-1/2 h-1 bg-slate-700 rounded" />
        </div>
        <div className="text-[9px] font-mono text-slate-400">Slide Presentation</div>
      </div>
    );
  }

  // 7. DOCX / Word Documents & PDFs
  if (category === 'docx' || category === 'pdf' || category === 'legacy_doc') {
    return (
      <div className="w-full h-full bg-slate-950 p-3 flex flex-col justify-between select-none">
        <div className="flex items-center justify-between text-xs">
          <FileText className={`w-5 h-5 ${category === 'pdf' ? 'text-rose-400' : 'text-blue-400'}`} />
          <span
            className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] uppercase ${
              category === 'pdf'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {ext}
          </span>
        </div>
        <div className="w-full h-12 bg-white text-slate-800 p-2 rounded shadow-inner flex flex-col justify-between">
          <div className="space-y-1">
            <div className="w-full h-1 bg-slate-400 rounded" />
            <div className="w-5/6 h-1 bg-slate-300 rounded" />
            <div className="w-4/6 h-1 bg-slate-300 rounded" />
          </div>
          <div className="text-[8px] font-mono text-slate-400 text-right">Page 1</div>
        </div>
        <div className="text-[9px] font-mono text-slate-400 truncate">Document File</div>
      </div>
    );
  }

  // 8. Archives
  if (category === 'archive') {
    return (
      <div className="w-full h-full bg-slate-950 p-3 flex flex-col justify-between select-none">
        <div className="flex items-center justify-between text-xs">
          <Archive className="w-5 h-5 text-amber-400" />
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold text-[9px] uppercase">
            {ext}
          </span>
        </div>
        <div className="w-full h-12 bg-slate-900 border border-slate-800 rounded p-1.5 space-y-1 font-mono text-[9px] text-slate-400">
          <div className="flex items-center gap-1 text-slate-300">📁 archive_root</div>
          <div className="flex items-center gap-1 pl-2 text-slate-500">📄 content_data</div>
        </div>
        <div className="text-[9px] font-mono text-slate-400">Compressed Package</div>
      </div>
    );
  }

  // Default fallback text card
  return (
    <div className="w-full h-full bg-slate-950 p-3 flex flex-col justify-between select-none">
      <div className="flex items-center justify-between text-xs">
        <FileText className="w-5 h-5 text-brand-400" />
        <span className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-mono font-bold text-[9px] uppercase">
          {ext || 'FILE'}
        </span>
      </div>
      <div className="flex flex-col items-center justify-center opacity-60">
        <FileText className="w-8 h-8 text-brand-400 mb-1" />
      </div>
      <div className="text-[9px] font-mono text-slate-400 text-center uppercase">{ext} File</div>
    </div>
  );
};
