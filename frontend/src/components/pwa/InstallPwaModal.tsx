import React, { useState, useEffect } from 'react';
import { HardDrive, Share, PlusSquare, X, Smartphone, ArrowDown } from 'lucide-react';

export const InstallPwaModal: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone PWA mode
    const standaloneCheck =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(standaloneCheck);

    if (standaloneCheck) {
      return; // Already installed as PWA home screen app
    }

    // 2. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // 3. Check mobile device or narrow screen width
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || window.innerWidth < 768;

    // 4. Check if dismissed recently (within last 12 hours)
    const lastDismissed = localStorage.getItem('teledrive_pwa_dismissed');
    const isRecentlyDismissed = lastDismissed && Date.now() - parseInt(lastDismissed, 10) < 12 * 60 * 60 * 1000;

    // 5. Listen for Android Chrome native beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isRecentlyDismissed) {
        setShowModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS / mobile browsers that do not fire beforeinstallprompt
    if (isMobile && !isRecentlyDismissed) {
      const timer = setTimeout(() => {
        setShowModal(true);
      }, 1200);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted TeleDrive PWA install');
      }
      setDeferredPrompt(null);
      setShowModal(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('teledrive_pwa_dismissed', Date.now().toString());
    setShowModal(false);
  };

  if (!showModal || isStandalone) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-50 max-w-md bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl p-4 sm:p-5 text-slate-100 backdrop-blur-xl animate-pop-in">
      {/* Modal Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-sky-400 p-0.5 shadow-lg shadow-brand-500/20 flex-shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-brand-400">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-heading">Add Zentro Drive to Home Screen</h3>
            <p className="text-[11px] text-slate-400">By Failed Engineers • Instant cloud access</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Android/Chrome prompt action */}
      {deferredPrompt ? (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-300 leading-relaxed">
            Install Zentro Drive as a native app on your phone for quick file uploads, instant camera sync, and fast offline navigation.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl text-xs font-semibold text-white transition-all shadow-lg shadow-brand-600/30"
            >
              <Smartphone className="w-4 h-4" />
              <span>Add to Home Screen</span>
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-slate-300 transition-colors"
            >
              Not Now
            </button>
          </div>
        </div>
      ) : isIOS ? (
        /* iOS Safari Instructions */
        <div className="space-y-3 pt-1">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-brand-300 font-medium">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-[11px]">1</span>
              <span>Tap the <Share className="w-3.5 h-3.5 text-blue-400 inline mx-0.5" /> <strong>Share</strong> button in Safari</span>
            </div>
            <div className="flex items-center gap-2 text-brand-300 font-medium">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-[11px]">2</span>
              <span>Scroll down and select <PlusSquare className="w-3.5 h-3.5 text-slate-200 inline mx-0.5" /> <strong>Add to Home Screen</strong></span>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleDismiss}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-slate-300 transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      ) : (
        /* General Mobile Browser instructions */
        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-300 leading-relaxed">
            Open your browser menu <span className="font-semibold text-white">⋮</span> and select <span className="font-semibold text-brand-300">"Add to Home Screen"</span> or <span className="font-semibold text-brand-300">"Install App"</span> for the best mobile experience.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="w-full py-2 bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 text-brand-300 rounded-xl text-xs font-semibold transition-all"
            >
              Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
