import React, { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import { FileText, AlertCircle } from 'lucide-react';
import { getFileExtension } from '../../utils/fileTypes';

interface DocxViewerProps {
  url: string;
  filename: string;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({ url, filename }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const ext = getFileExtension(filename);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    if (ext === 'docx') {
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((arrayBuffer) => mammoth.convertToHtml({ arrayBuffer }))
        .then((result) => {
          if (isMounted) {
            setHtmlContent(result.value);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err.message || 'Failed to render DOCX document');
            setLoading(false);
          }
        });
    } else {
      // For legacy binary formats (.doc, .rtf, .wps, .wpd)
      fetch(url)
        .then((res) => res.text())
        .then((text) => {
          if (isMounted) {
            // Strip out raw binary control chars if RTF/DOC text
            const cleanedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
            setHtmlContent(`<pre class="whitespace-pre-wrap font-sans leading-relaxed">${cleanedText.slice(0, 10000)}</pre>`);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err.message || 'Failed to read document');
            setLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [url, ext]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Parsing Document ({ext.toUpperCase()})...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-amber-400 bg-amber-950/20 rounded-xl border border-amber-900/40 max-w-md">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-amber-400" />
        <p className="text-sm font-semibold mb-1">Document Format Notice</p>
        <p className="text-xs text-amber-300/80 mb-3">{error}</p>
        <p className="text-xs text-slate-400">
          Legacy binary Word formats ({ext}) are best viewed when downloaded to Microsoft Word or WPS Office.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-400" />
          <span className="font-semibold text-slate-200">{filename}</span>
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono font-bold uppercase">
            {ext}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 bg-slate-950/50 flex justify-center">
        <div className="w-full max-w-3xl bg-white text-slate-900 p-8 sm:p-12 rounded-lg shadow-xl font-sans min-h-[600px] prose prose-slate max-w-none">
          {htmlContent ? (
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          ) : (
            <p className="text-slate-400 italic text-sm">Empty document</p>
          )}
        </div>
      </div>
    </div>
  );
};
