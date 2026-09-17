import React, { useState } from 'react';
import { apiRequest } from '../../services/api';
import { Bot, Send, X, FileText, Sparkles } from 'lucide-react';

interface AskFilesDrawerProps {
  onClose: () => void;
}

export const AskFilesDrawer: React.FC<AskFilesDrawerProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<
    Array<{ sender: 'user' | 'ai'; text: string; citations?: Array<{ fileId: string; filename: string }> }>
  >([
    {
      sender: 'ai',
      text: 'Hello! Ask me any question regarding the documents stored in your drive (e.g. project costs, summaries, figures).',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userText = query.trim();
    setQuery('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await apiRequest<{ answer: string; citations: Array<{ fileId: string; filename: string }> }>(
        '/ai/ask',
        {
          method: 'POST',
          body: JSON.stringify({ query: userText }),
        }
      );

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer,
          citations: res.citations,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: `Sorry, an error occurred: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-pop-in text-slate-100">
      {/* Header */}
      <header className="h-14 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-400" />
          <h3 className="text-sm font-semibold text-slate-100">Ask Your Files</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-brand-600 text-white rounded-br-none'
                  : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-none'
              }`}
            >
              {m.text}
            </div>
            {m.citations && m.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.citations.map((c) => (
                  <span
                    key={c.fileId}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-300"
                  >
                    <FileText className="w-3 h-3 text-brand-400" />
                    {c.filename}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
            <Bot className="w-4 h-4 text-brand-400" />
            Analyzing drive documents...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your files..."
          className="flex-1 bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="p-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
