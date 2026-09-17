import React, { useEffect, useState } from 'react';
import { FileItem } from '../../context/DriveContext';
import { getFileRawUrl, uploadFileVersion } from '../../services/api';
import { getFileExtension } from '../../utils/fileTypes';
import {
  X,
  Save,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  FileText,
  Eye,
  Edit3,
  Check,
  AlertCircle,
} from 'lucide-react';

interface DocumentEditorModalProps {
  file: FileItem;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const DocumentEditorModal: React.FC<DocumentEditorModalProps> = ({
  file,
  onClose,
  onSaveSuccess,
}) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const ext = getFileExtension(file.name);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(getFileRawUrl(file.id))
      .then((res) => res.text())
      .then((text) => {
        if (isMounted) {
          // Clean text control characters if legacy document
          const cleanedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
          setContent(cleanedText);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load document content');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [file.id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      await uploadFileVersion(file.id, blob, file.name);
      setSaving(false);
      setSaveSuccess(true);
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setSaving(false);
      setError(err.message || 'Failed to save file changes');
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content]);

  // Simple formatting helper for textarea
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('doc-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = `${prefix}${selectedText || 'Text'}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 50);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col text-slate-100 animate-fade-in">
      {/* Editor Header */}
      <header className="h-14 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-brand-400" />
          <div>
            <h3 className="text-sm font-semibold truncate max-w-sm text-slate-100" title={file.name}>
              {file.name}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Document Editor • <span className="uppercase text-brand-400 font-bold">{ext}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                activeTab === 'editor' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                activeTab === 'preview' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all shadow-md ${
              saveSuccess
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-brand-600 hover:bg-brand-500 active:scale-95'
            }`}
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save (Ctrl+S)'}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Formatting Toolbar */}
      {activeTab === 'editor' && (
        <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center gap-1 flex-wrap text-xs text-slate-300 shrink-0">
          <button
            onClick={() => insertFormatting('# ', '')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('## ', '')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('### ', '')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 my-auto mx-1" />

          <button
            onClick={() => insertFormatting('**', '**')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('*', '*')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('<u>', '</u>')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Underline"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('~~', '~~')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 my-auto mx-1" />

          <button
            onClick={() => insertFormatting('- ', '')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('1. ', '')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor Body Canvas */}
      <main className="flex-1 overflow-hidden p-6 bg-slate-950 flex justify-center items-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium">Loading Document Content...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 bg-rose-950/20 rounded-xl border border-rose-900/40">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-xs">{error}</p>
          </div>
        ) : activeTab === 'editor' ? (
          <div className="w-full h-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-700">
            <textarea
              id="doc-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your document content here..."
              className="w-full h-full p-8 font-sans text-sm leading-relaxed border-none focus:outline-none resize-none text-slate-900 bg-white"
            />
          </div>
        ) : (
          <div className="w-full h-full max-w-4xl bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-2xl overflow-auto border border-slate-700 font-sans prose prose-slate max-w-none">
            <div className="whitespace-pre-wrap leading-relaxed">{content}</div>
          </div>
        )}
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 px-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
        <div>
          Words: <span className="text-slate-200 font-bold">{wordCount}</span> • Characters:{' '}
          <span className="text-slate-200 font-bold">{charCount}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>{saving ? 'Saving...' : saveSuccess ? 'Saved' : 'Editing Mode'}</span>
        </div>
      </footer>
    </div>
  );
};
