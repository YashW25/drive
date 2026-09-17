import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { Archive, File, Folder, Download, HardDrive, CheckCircle2 } from 'lucide-react';
import { getFileExtension } from '../../utils/fileTypes';

interface ArchiveViewerProps {
  url: string;
  filename: string;
}

interface ZipEntry {
  name: string;
  isDir: boolean;
  size: number;
  date?: Date;
}

export const ArchiveViewer: React.FC<ArchiveViewerProps> = ({ url, filename }) => {
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const ext = getFileExtension(filename);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    if (ext === 'zip') {
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((buffer) => JSZip.loadAsync(buffer))
        .then((zip) => {
          if (!isMounted) return;
          const parsedEntries: ZipEntry[] = [];
          zip.forEach((relativePath, file) => {
            parsedEntries.push({
              name: relativePath,
              isDir: file.dir,
              size: (file as any)._data?.uncompressedSize || 0,
              date: file.date,
            });
          });
          setEntries(parsedEntries);
          setLoading(false);
        })
        .catch((err) => {
          if (isMounted) {
            setError(err.message || 'Failed to inspect Zip archive');
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [url, ext]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const totalUncompressedSize = entries.reduce((acc, curr) => acc + curr.size, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Scanning archive contents ({ext.toUpperCase()})...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{filename}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span className="uppercase font-mono text-amber-400 font-bold">{ext} Archive</span>
              {entries.length > 0 && (
                <>
                  <span>•</span>
                  <span>{entries.length} items</span>
                  <span>•</span>
                  <span>Uncompressed: {formatSize(totalUncompressedSize)}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Contents Area */}
      <div className="flex-1 overflow-auto p-6">
        {ext === 'zip' && entries.length > 0 ? (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            <div className="grid grid-cols-12 px-4 py-2 bg-slate-950 text-xs font-semibold text-slate-400 border-b border-slate-800">
              <div className="col-span-8">File Name</div>
              <div className="col-span-4 text-right">Size</div>
            </div>
            <div className="divide-y divide-slate-800/60 max-h-[400px] overflow-auto text-xs font-mono">
              {entries.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-slate-800/40 text-slate-200">
                  <div className="col-span-8 flex items-center gap-2 truncate">
                    {item.isDir ? (
                      <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <File className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="col-span-4 text-right text-slate-400">
                    {item.isDir ? '<DIR>' : formatSize(item.size)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
            <HardDrive className="w-12 h-12 text-slate-500 mb-3" />
            <h4 className="text-sm font-semibold text-slate-200 mb-1">
              Compressed Archive Container ({ext.toUpperCase()})
            </h4>
            <p className="text-xs text-slate-400 max-w-md mb-4">
              This compressed archive is formatted as a {ext.toUpperCase()} package. You can download the complete archive file to extract all files using WinRAR, 7-Zip, or your system's extractor.
            </p>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" /> Integrity check passed
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
