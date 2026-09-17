import React, { useState } from 'react';
import { FileItem } from '../../context/DriveContext';
import { uploadFileVersion } from '../../services/api';
import { getFileExtension } from '../../utils/fileTypes';
import {
  X,
  Save,
  Plus,
  Trash2,
  Presentation,
  Play,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  bgColor: string;
}

interface PresentationEditorModalProps {
  file: FileItem;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const PresentationEditorModal: React.FC<PresentationEditorModalProps> = ({
  file,
  onClose,
  onSaveSuccess,
}) => {
  const [slides, setSlides] = useState<Slide[]>([
    {
      id: 1,
      title: 'Presentation Title',
      subtitle: 'Subtitle or Author Name',
      body: '• Key takeaway point 1\n• Key takeaway point 2\n• Summary conclusion',
      bgColor: 'bg-slate-900',
    },
    {
      id: 2,
      title: 'Project Details & Goals',
      subtitle: 'Overview Section',
      body: '• Deliver modern web user experiences\n• Zentro cloud storage engine by Failed Engineers',
      bgColor: 'bg-slate-900',
    },
  ]);

  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [isFullscreenMode, setIsFullscreenMode] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const ext = getFileExtension(file.name);

  const currentSlide = slides[activeSlideIdx] || slides[0];

  const updateSlide = (field: keyof Slide, value: string) => {
    const updated = slides.map((s, idx) => (idx === activeSlideIdx ? { ...s, [field]: value } : s));
    setSlides(updated);
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: Date.now(),
      title: `Slide ${slides.length + 1}`,
      subtitle: 'Subtitle text',
      body: '• Add details here',
      bgColor: 'bg-slate-900',
    };
    setSlides([...slides, newSlide]);
    setActiveSlideIdx(slides.length);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== idx);
    setSlides(next);
    setActiveSlideIdx(Math.max(0, activeSlideIdx - 1));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const jsonContent = JSON.stringify(slides, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      await uploadFileVersion(file.id, blob, file.name);
      setSaving(false);
      setSaveSuccess(true);
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col text-slate-100 animate-fade-in">
      {/* Header */}
      <header className="h-14 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <Presentation className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-semibold truncate max-w-sm text-slate-100" title={file.name}>
              {file.name}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Slide Deck Editor • <span className="uppercase text-amber-400 font-bold">{ext}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFullscreenMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Present
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all shadow-md ${
              saveSuccess ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-brand-600 hover:bg-brand-500 active:scale-95'
            }`}
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Deck'}
          </button>

          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      {isFullscreenMode ? (
        // Fullscreen Presentation Slideshow Mode
        <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center relative p-8">
          <div className="w-full max-w-5xl aspect-video bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-2xl p-16 flex flex-col justify-between text-center relative overflow-hidden">
            <div>
              <h1 className="text-4xl font-extrabold text-amber-400 mb-4">{currentSlide.title}</h1>
              <p className="text-lg text-slate-400 font-medium mb-8">{currentSlide.subtitle}</p>
            </div>
            <div className="text-left max-w-2xl mx-auto text-slate-200 text-base leading-relaxed whitespace-pre-wrap">
              {currentSlide.body}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Slide {activeSlideIdx + 1} of {slides.length}
            </div>
          </div>

          <div className="absolute bottom-6 flex items-center gap-4 bg-slate-900/90 border border-slate-800 p-2 rounded-xl backdrop-blur">
            <button
              onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
              disabled={activeSlideIdx === 0}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono font-bold text-amber-400">
              {activeSlideIdx + 1} / {slides.length}
            </span>
            <button
              onClick={() => setActiveSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
              disabled={activeSlideIdx === slides.length - 1}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsFullscreenMode(false)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg ml-2"
            >
              Exit Presentation
            </button>
          </div>
        </div>
      ) : (
        <main className="flex-1 flex overflow-hidden">
          {/* Slide Sidebar */}
          <aside className="w-64 border-r border-slate-800 bg-slate-950 p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-3 overflow-auto max-h-[80vh]">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                <span>SLIDES ({slides.length})</span>
                <button
                  onClick={addSlide}
                  className="p-1 hover:bg-slate-800 text-amber-400 rounded transition-colors"
                  title="Add Slide"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  onClick={() => setActiveSlideIdx(idx)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                    idx === activeSlideIdx
                      ? 'bg-amber-500/10 border-amber-500/50 text-slate-100 shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate">
                    <span className="text-[10px] font-mono font-bold text-amber-400 block mb-0.5">SLIDE {idx + 1}</span>
                    <h5 className="text-xs font-medium truncate">{slide.title || 'Untitled Slide'}</h5>
                  </div>
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSlide(idx);
                      }}
                      className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* Active Slide Canvas Editor */}
          <section className="flex-1 p-8 bg-slate-950 flex flex-col items-center justify-center">
            <div className="w-full max-w-4xl aspect-video bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-12 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <input
                  type="text"
                  value={currentSlide.title}
                  onChange={(e) => updateSlide('title', e.target.value)}
                  placeholder="Slide Title"
                  className="w-full bg-transparent text-2xl font-bold text-amber-400 border-b border-transparent focus:border-amber-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={currentSlide.subtitle}
                  onChange={(e) => updateSlide('subtitle', e.target.value)}
                  placeholder="Slide Subtitle"
                  className="w-full bg-transparent text-sm text-slate-400 font-medium border-b border-transparent focus:border-slate-700 focus:outline-none"
                />
              </div>

              <textarea
                value={currentSlide.body}
                onChange={(e) => updateSlide('body', e.target.value)}
                placeholder="Slide content body (bullet points, details)..."
                className="w-full flex-1 bg-slate-950/60 p-4 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-none font-sans leading-relaxed"
              />
            </div>
          </section>
        </main>
      )}
    </div>
  );
};
