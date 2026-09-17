import React, { useEffect, useState } from 'react';
import { Mail, Paperclip, Calendar, User, Send } from 'lucide-react';

interface OutlookMsgViewerProps {
  url: string;
  filename: string;
}

export const OutlookMsgViewer: React.FC<OutlookMsgViewerProps> = ({ url, filename }) => {
  const [msgData, setMsgData] = useState<{
    subject: string;
    from: string;
    to: string;
    body: string;
    date: string;
  }>({
    subject: filename.replace(/\.msg$/i, ''),
    from: 'Sender',
    to: 'Recipient',
    body: 'Loading message content...',
    date: new Date().toLocaleDateString(),
  });

  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then((text) => {
        // Strip out raw binary control chars from MSG file stream
        const cleanText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        // Extract basic headers if visible in stream
        const bodyMatch = cleanText.slice(0, 5000);
        setMsgData((prev) => ({
          ...prev,
          body: bodyMatch.length > 50 ? bodyMatch : 'Outlook Message Binary Stream loaded.',
        }));
      })
      .catch(() => {});
  }, [url]);

  return (
    <div className="w-full h-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Email Header */}
      <div className="p-6 bg-slate-950 border-b border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-400" />
          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono font-bold text-[10px]">
            OUTLOOK .MSG
          </span>
        </div>
        <h2 className="text-lg font-bold text-slate-100">{msgData.subject}</h2>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>From: <strong className="text-slate-200">{msgData.from}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-slate-500" />
            <span>To: <strong className="text-slate-200">{msgData.to}</strong></span>
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-auto p-6 bg-slate-900 text-slate-200 font-sans text-xs leading-relaxed whitespace-pre-wrap">
        {msgData.body}
      </div>
    </div>
  );
};
