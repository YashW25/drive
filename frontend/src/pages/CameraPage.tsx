import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Video,
  Square,
  Circle,
  RefreshCw,
  SwitchCamera,
  Check,
  X,
  FolderCheck,
  AlertCircle,
  Folder,
  Trash2,
  Play,
  Sparkles,
  Zap,
  Image as ImageIcon,
  Film,
  ExternalLink,
  CameraOff,
  Power,
  Maximize2,
  Minimize2,
  CloudOff,
  WifiOff,
} from 'lucide-react';
import { useDrive } from '../context/DriveContext';
import { apiRequest } from '../services/api';
import { offlineStorage } from '../services/OfflineStorageService';
import { offlineSyncService } from '../services/OfflineSyncService';

interface SessionCapturedItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  name: string;
  size: number;
  blob: Blob;
  uploaded: boolean;
  uploading: boolean;
  isOfflineQueued?: boolean;
}

export const CameraPage: React.FC = () => {
  const { folders, refreshDrive, setActiveView, setCurrentFolderId } = useDrive();
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const [sessionItems, setSessionItems] = useState<SessionCapturedItem[]>([]);
  const [previewMedia, setPreviewMedia] = useState<SessionCapturedItem | null>(null);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  const [flash, setFlash] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraFolderId, setCameraFolderId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const stopCameraHardware = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  };

  // 1. Ensure /Camera folder exists in root drive
  useEffect(() => {
    let isMounted = true;

    const initCameraFolder = async () => {
      try {
        // Direct root query to guarantee folder check regardless of activeView
        const res = await apiRequest<{ folders: Array<{ id: string; name: string; parentFolderId: string | null }> }>(
          '/folders?folderId=root'
        );

        let cameraFolder = res?.folders?.find(
          (f) => f.name.toLowerCase() === 'camera' && (f.parentFolderId === null || f.parentFolderId === undefined)
        );

        if (cameraFolder) {
          if (isMounted) setCameraFolderId(cameraFolder.id);
        } else {
          const newFolder = await apiRequest<{ id: string }>('/folders', {
            method: 'POST',
            body: JSON.stringify({ name: 'Camera', parentFolderId: null }),
          });
          if (newFolder && newFolder.id && isMounted) {
            setCameraFolderId(newFolder.id);
            if (refreshDrive) refreshDrive();
          }
        }
      } catch (err) {
        console.error('Camera folder init error:', err);
      }
    };

    initCameraFolder();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Initialize camera stream (and turn off completely on unmount / nav shift)
  useEffect(() => {
    let isMounted = true;

    if (!isCameraActive) {
      stopCameraHardware();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      const vDevices = devices.filter((d) => d.kind === 'videoinput');
      if (isMounted) {
        setVideoDevices(vDevices);
        if (vDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(vDevices[0].deviceId);
        }
      }
    });

    const constraints: MediaStreamConstraints = {
      video: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: mode === 'video',
    };

    navigator.mediaDevices
      ?.getUserMedia(constraints)
      .then((mediaStream) => {
        if (!isMounted || !isCameraActive) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Camera access error:', err);
          setError('Unable to access camera or microphone. Please check browser permissions.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      stopCameraHardware();
    };
  }, [mode, selectedDeviceId, isCameraActive]);

  // 3. Handle Recording Timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleSwitchCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    setSelectedDeviceId(videoDevices[nextIndex].deviceId);
  };

  // Subscribe to offlineSyncService for automatic badge updates when reconnecting online
  useEffect(() => {
    const unsubscribe = offlineSyncService.subscribe(({ syncedCount }) => {
      if (syncedCount > 0) {
        setSessionItems((prev) =>
          prev.map((item) => (item.isOfflineQueued ? { ...item, uploaded: true, isOfflineQueued: false } : item))
        );
        if (refreshDrive) refreshDrive();
      }
    });
    return () => unsubscribe();
  }, [refreshDrive]);

  // Upload captured item in background directly to /Camera folder (or queue offline if disconnected)
  const uploadCapturedMedia = async (blob: Blob, name: string, type: 'photo' | 'video') => {
    const newItemId = Math.random().toString(36).substring(7);
    const blobUrl = URL.createObjectURL(blob);

    const newItem: SessionCapturedItem = {
      id: newItemId,
      type,
      url: blobUrl,
      name,
      size: blob.size,
      blob,
      uploaded: false,
      uploading: true,
      isOfflineQueued: false,
    };

    setSessionItems((prev) => [newItem, ...prev]);

    // Handle offline capture
    if (!navigator.onLine) {
      await offlineStorage.enqueueOfflineCameraMedia({
        id: newItemId,
        name,
        type,
        mimeType: blob.type,
        size: blob.size,
        blob,
        cameraFolderId,
        createdAt: Date.now(),
      });
      setSessionItems((prev) =>
        prev.map((item) =>
          item.id === newItemId ? { ...item, uploading: false, uploaded: false, isOfflineQueued: true } : item
        )
      );
      return;
    }

    try {
      const fileToUpload = new File([blob], name, { type: blob.type });
      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (cameraFolderId) {
        formData.append('folderId', cameraFolderId);
      }

      await apiRequest('/files/upload', {
        method: 'POST',
        body: formData,
      });

      setSessionItems((prev) =>
        prev.map((item) =>
          item.id === newItemId ? { ...item, uploading: false, uploaded: true, isOfflineQueued: false } : item
        )
      );

      if (refreshDrive) refreshDrive();
    } catch (err) {
      console.warn('Network upload failed, storing locally & queueing auto-sync:', err);
      await offlineStorage.enqueueOfflineCameraMedia({
        id: newItemId,
        name,
        type,
        mimeType: blob.type,
        size: blob.size,
        blob,
        cameraFolderId,
        createdAt: Date.now(),
      });
      setSessionItems((prev) =>
        prev.map((item) =>
          item.id === newItemId ? { ...item, uploading: false, uploaded: false, isOfflineQueued: true } : item
        )
      );
    }
  };

  // Snap Photo (Continuous Capture)
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    setFlash(true);
    setTimeout(() => setFlash(false), 180);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const now = new Date();
          const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const name = `photo_${dateStr}.jpg`;
          uploadCapturedMedia(blob, name, 'photo');
        }
      },
      'image/jpeg',
      0.95
    );
  };

  // Start Video Recording
  const handleStartRecording = () => {
    if (!stream) return;
    recordedChunksRef.current = [];

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const name = `video_${dateStr}.${ext}`;
        uploadCapturedMedia(videoBlob, name, 'video');
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start video recording:', err);
      setError('Failed to start video recorder.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDeleteSessionItem = (id: string) => {
    setSessionItems((prev) => prev.filter((item) => item.id !== id));
    if (previewMedia?.id === id) {
      setPreviewMedia(null);
    }
  };

  const handleGoToCameraFolder = () => {
    if (cameraFolderId) {
      setCurrentFolderId(cameraFolderId);
    }
    setActiveView('drive');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative animate-fade-in ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-full'
      }`}
    >
      {/* Flash Overlay */}
      {flash && <div className="absolute inset-0 bg-white z-40 animate-ping opacity-90 pointer-events-none" />}

      {/* Top Navigation & Status Header */}
      {!isFullscreen && (
        <div className="px-3 py-2.5 sm:px-6 sm:py-3.5 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-sky-600 via-indigo-600 to-brand-500 rounded-xl sm:rounded-2xl text-white shadow-lg shadow-sky-500/20 flex-shrink-0">
              <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-base font-bold font-heading text-slate-100 truncate">TeleDrive Camera App</h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Continuous capture • Saved to <strong className="text-emerald-400 font-semibold">/Camera</strong>
              </p>
            </div>
          </div>

          {/* Power Toggle, Fullscreen & Folder Navigation */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-3 flex-shrink-0 ml-auto">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-200 transition-all shadow-sm"
              title="Toggle Fullscreen Camera Mode"
            >
              <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
              <span className="hidden xs:inline">Fullscreen</span>
            </button>

            <button
              onClick={() => {
                if (isCameraActive) {
                  if (isRecording) handleStopRecording();
                  setIsCameraActive(false);
                } else {
                  setIsCameraActive(true);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-all shadow-sm ${
                isCameraActive
                  ? 'bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400'
              }`}
              title={isCameraActive ? 'Turn off camera stream & release hardware' : 'Start camera hardware stream'}
            >
              {isCameraActive ? (
                <>
                  <CameraOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Start</span>
                </>
              )}
            </button>

            <button
              onClick={handleGoToCameraFolder}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-[11px] sm:text-xs font-semibold text-emerald-400 transition-all shadow-sm"
            >
              <FolderCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Open /Camera</span>
              <span className="xs:hidden">/Camera</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70 hidden xs:inline" />
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport & Camera Canvas */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Viewfinder Canvas */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-[250px] sm:min-h-[350px]">
          {!isCameraActive && (
            <div className="p-6 sm:p-8 text-center text-slate-300 max-w-md bg-slate-900/90 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center animate-fade-in z-30 mx-4">
              <div className="p-3.5 sm:p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60 mb-3 sm:mb-4 text-rose-400 shadow-inner">
                <CameraOff className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 mb-1">Camera Stream Stopped</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mb-5 sm:mb-6 leading-relaxed">
                Camera hardware access is disabled and completely turned off. No background streaming or recording is active.
              </p>
              <button
                onClick={() => setIsCameraActive(true)}
                className="flex items-center gap-2 px-5 py-2 sm:px-6 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Power className="w-4 h-4" />
                <span>Start / Allow Camera</span>
              </button>
            </div>
          )}

          {isCameraActive && loading && (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-brand-500 mb-3" />
              <p className="text-xs sm:text-sm font-semibold">Initializing Camera Hardware...</p>
            </div>
          )}

          {isCameraActive && error && (
            <div className="p-6 sm:p-8 text-center text-rose-400 max-w-md bg-rose-950/20 rounded-2xl border border-rose-900/40 mx-4">
              <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-rose-400" />
              <h3 className="text-sm sm:text-base font-bold mb-1">Camera Permission Error</h3>
              <p className="text-[11px] sm:text-xs text-rose-300/80 mb-4">{error}</p>
              <button
                onClick={() => setIsCameraActive(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors"
              >
                Retry Access
              </button>
            </div>
          )}

          {isCameraActive && !error && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[85vh]"
              />

              {/* Recording Pulse HUD */}
              {isRecording && (
                <div className="absolute top-4 left-4 sm:top-5 sm:left-5 flex items-center gap-2 bg-rose-600/90 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-2xl text-[11px] sm:text-xs font-mono font-bold animate-pulse z-20">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white animate-ping" />
                  <span>REC {formatTime(recordingSeconds)}</span>
                </div>
              )}

              {/* Overlay Controls (Switcher & Fullscreen) */}
              <div className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-2 z-20">
                {videoDevices.length > 1 && (
                  <button
                    onClick={handleSwitchCamera}
                    className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-200 hover:text-white transition-all shadow-lg"
                    title="Switch Camera Device"
                  >
                    <SwitchCamera className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
                <button
                  onClick={toggleFullscreen}
                  className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-200 hover:text-white transition-all shadow-lg"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Camera'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
                  ) : (
                    <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
                  )}
                </button>
              </div>

              {/* Shutter Mode Controls Bar */}
              <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-slate-950/85 backdrop-blur-md p-1.5 sm:p-2 rounded-full border border-slate-800 shadow-2xl z-20 max-w-[94vw]">
                {/* Mode Selector */}
                <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900 p-0.5 sm:p-1 rounded-full border border-slate-800">
                  <button
                    onClick={() => !isRecording && setMode('photo')}
                    disabled={isRecording}
                    className={`flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold transition-all ${
                      mode === 'photo' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Photo</span>
                  </button>
                  <button
                    onClick={() => !isRecording && setMode('video')}
                    disabled={isRecording}
                    className={`flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold transition-all ${
                      mode === 'video' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Video</span>
                  </button>
                </div>

                {/* Main Shutter Button */}
                {mode === 'photo' ? (
                  <button
                    onClick={handleSnapPhoto}
                    disabled={loading || !!error || !isCameraActive}
                    className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-tr from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-full shadow-2xl shadow-brand-500/40 transition-all active:scale-90 border-3 sm:border-4 border-slate-900 disabled:opacity-50 flex-shrink-0"
                    title="Snap Photo"
                  >
                    <Circle className="w-6 h-6 sm:w-7 sm:h-7 fill-white" />
                  </button>
                ) : (
                  <>
                    {!isRecording ? (
                      <button
                        onClick={handleStartRecording}
                        disabled={loading || !!error || !isCameraActive}
                        className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-2xl shadow-rose-600/40 transition-all active:scale-90 border-3 sm:border-4 border-slate-900 disabled:opacity-50 flex-shrink-0"
                        title="Start Video Recording"
                      >
                        <Circle className="w-6 h-6 sm:w-7 sm:h-7 fill-white animate-pulse" />
                      </button>
                    ) : (
                      <button
                        onClick={handleStopRecording}
                        className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-slate-800 hover:bg-slate-700 text-rose-500 rounded-full border-3 sm:border-4 border-rose-500 shadow-2xl transition-all active:scale-90 flex-shrink-0"
                        title="Stop Video Recording"
                      >
                        <Square className="w-5 h-5 sm:w-6 sm:h-6 fill-rose-500" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right / Bottom Continuous Capture Session Roll */}
        <div className="w-full md:w-80 bg-slate-900/90 border-t md:border-t-0 md:border-l border-slate-800 p-4 flex flex-col justify-between shrink-0 max-h-[38vh] md:max-h-full overflow-hidden">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Session Gallery</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-[11px] font-mono text-emerald-400 font-bold">
                {sessionItems.length} Saved
              </span>
            </div>

            {/* Gallery Thumbnail Strip */}
            <div className="space-y-2 overflow-y-auto max-h-[48vh] pr-1">
              {sessionItems.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No photos or videos captured in this session yet. Click the shutter button to snap continuous media!
                </div>
              ) : (
                sessionItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setPreviewMedia(item)}
                    className="p-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-3 cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                        {item.type === 'photo' ? (
                          <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-indigo-950 flex items-center justify-center text-indigo-400">
                            <Film className="w-5 h-5" />
                          </div>
                        )}
                        {item.uploading && (
                          <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          </div>
                        )}
                      </div>

                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {formatSize(item.size)} • {item.type.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.isOfflineQueued ? (
                        <span className="p-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-1 text-[10px] font-semibold" title="Queued Offline — Will auto-sync when online">
                          <CloudOff className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Offline</span>
                        </span>
                      ) : item.uploaded ? (
                        <span className="p-1 text-emerald-400 bg-emerald-500/10 rounded-lg" title="Saved to /Camera">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSessionItem(item.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Remove from session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between font-mono">
            <span>Status: <strong className="text-slate-300">Ready</strong></span>
            <span>Folder: <strong className="text-emerald-400">/Camera</strong></span>
          </div>
        </div>
      </div>

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-slate-100 relative animate-pop-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold truncate max-w-md">{previewMedia.name}</h3>
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full max-h-[60vh] bg-black rounded-xl overflow-hidden flex items-center justify-center p-2 mb-4">
              {previewMedia.type === 'photo' ? (
                <img src={previewMedia.url} alt={previewMedia.name} className="max-h-[55vh] object-contain rounded-lg" />
              ) : (
                <video src={previewMedia.url} controls autoPlay className="max-h-[55vh] object-contain rounded-lg" />
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Size: <strong className="text-slate-200">{formatSize(previewMedia.size)}</strong></span>
              <button
                onClick={() => setPreviewMedia(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
