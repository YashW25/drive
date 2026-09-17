import React, { useEffect, useState } from 'react';
import { Copy, Check, WrapText, Search, Table, Code2 } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import { getPrismLanguage } from '../../utils/fileTypes';

interface TextViewerProps {
  url: string;
  filename: string;
  isCsv?: boolean;
}

export const TextViewer: React.FC<TextViewerProps> = ({ url, filename, isCsv = false }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'code' | 'table'>(isCsv ? 'table' : 'code');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (isMounted) {
          setContent(text);
          setLoading(false);
          setTimeout(() => Prism.highlightAll(), 50);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to fetch text content');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = content.split('\n');
  const lang = getPrismLanguage(filename);

  // Simple CSV parser for Table view
  const parseCsv = (text: string) => {
    const rows = text
      .trim()
      .split('\n')
      .map((row) => row.split(',').map((cell) => cell.trim().replace(/^"(.*)"$/, '$1')));
    return rows;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-rose-400 bg-rose-950/20 rounded-xl border border-rose-900/40">
        <p className="text-sm font-semibold mb-1">Unable to display text file</p>
        <p className="text-xs text-rose-300/80">{error}</p>
      </div>
    );
  }

  const csvRows = isCsv || filename.endsWith('.csv') ? parseCsv(content) : [];

  return (
    <div className="w-full h-full max-w-5xl flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
      {/* Top Toolbar */}
      <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 font-mono font-semibold uppercase text-[10px]">
            {lang}
          </span>
          <span className="text-slate-400">
            {lines.length} lines • {content.length} characters
          </span>

          {(isCsv || filename.endsWith('.csv')) && (
            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  viewMode === 'table' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3 h-3" /> Grid
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  viewMode === 'code' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3 h-3" /> Raw Text
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          {viewMode === 'code' && (
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2 text-slate-500" />
              <input
                type="text"
                placeholder="Find in text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-2 py-1 bg-slate-900 border border-slate-700 rounded-md text-slate-200 text-xs focus:outline-none focus:border-brand-500 w-36 focus:w-48 transition-all"
              />
            </div>
          )}

          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`p-1.5 rounded-md border text-xs flex items-center gap-1 transition-colors ${
              wordWrap
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Main View Mode Rendering */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
        {viewMode === 'table' && csvRows.length > 0 ? (
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-slate-200 border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                  <th className="p-2 w-10 text-center border-r border-slate-800 text-[10px]">#</th>
                  {csvRows[0]?.map((colHeader, i) => (
                    <th key={i} className="p-2 border-r border-slate-800 font-semibold text-slate-300">
                      {colHeader || `Column ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(1).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                    <td className="p-2 text-center border-r border-slate-800 text-slate-500 text-[10px]">
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="p-2 border-r border-slate-800/60">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <pre
            className={`font-mono text-xs ${
              wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'
            }`}
          >
            <code className={`language-${lang}`}>
              {lines.map((line, idx) => {
                const match = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
                return (
                  <div
                    key={idx}
                    className={`flex gap-4 ${match ? 'bg-amber-500/20 text-amber-200 -mx-4 px-4' : ''}`}
                  >
                    <span className="w-10 select-none text-right text-slate-600 font-sans text-[11px] shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1">{line}</span>
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
};
