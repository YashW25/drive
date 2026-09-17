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
  Sparkles,
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { apiRequest } from '../../services/api';

interface CameraCaptureModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ onClose, onSuccess }) => {
  const { folders, refreshDrive } = useDrive();
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedPhotoBlob, setCapturedPhotoBlob] = useState<Blob | null>(null);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);

  const [flash, setFlash] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStreamHardware = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  };

  // Initialize camera stream
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    // List available video devices
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
        if (!isMounted) {
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
          setError('Unable to access camera or microphone. Please allow permissions in your browser.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      stopStreamHardware();
    };
  }, [mode, selectedDeviceId]);

  // Handle Video Recording Timer
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

  // Snap Photo
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Trigger flash animation effect
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedPhotoBlob(blob);
          setCapturedPhotoUrl(url);
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
        const videoUrl = URL.createObjectURL(videoBlob);
        setRecordedVideoBlob(videoBlob);
        setRecordedVideoUrl(videoUrl);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start video recording:', err);
      setError('Failed to start video recorder.');
    }
  };

  // Stop Video Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleRetake = () => {
    if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setCapturedPhotoBlob(null);
    setCapturedPhotoUrl(null);
    setRecordedVideoBlob(null);
    setRecordedVideoUrl(null);
  };

  // Save captured photo/video to default "Camera" folder
  const handleSaveToCameraFolder = async () => {
    try {
      setSaving(true);
      setError(null);

      // Find or create "Camera" folder in root My Drive
      let cameraFolder = folders.find(
        (f) => f.name.toLowerCase() === 'camera' && f.parentFolderId === null
      );

      let targetFolderId: string | null = cameraFolder ? cameraFolder.id : null;

      if (!cameraFolder) {
        // Create "Camera" folder via API
        try {
          const res = await apiRequest<{ id: string }>('/folders', {
            method: 'POST',
            body: JSON.stringify({ name: 'Camera', parentFolderId: null }),
          });
          if (res && res.id) {
            targetFolderId = res.id;
          }
        } catch (fErr) {
          console.warn('Camera folder creation warning:', fErr);
        }
      }

      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

      let fileToUpload: File;

      if (mode === 'photo' && capturedPhotoBlob) {
        const filename = `photo_${dateStr}.jpg`;
        fileToUpload = new File([capturedPhotoBlob], filename, { type: 'image/jpeg' });
      } else if (mode === 'video' && recordedVideoBlob) {
        const ext = recordedVideoBlob.type.includes('mp4') ? 'mp4' : 'webm';
        const filename = `video_${dateStr}.${ext}`;
        fileToUpload = new File([recordedVideoBlob], filename, { type: recordedVideoBlob.type });
      } else {
        throw new Error('No captured photo or video found');
      }

      // Upload directly via FormData
      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (targetFolderId) {
        formData.append('folderId', targetFolderId);
      }

      await apiRequest('/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (refreshDrive) {
        await refreshDrive();
      }

      setSaving(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save camera file:', err);
      setSaving(false);
      setError(err.message || 'Failed to save camera file to Camera folder.');
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-slate-100">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-pop-in max-h-[92vh]">
        {/* Flash overlay */}
        {flash && <div className="absolute inset-0 bg-white z-40 animate-ping opacity-80 pointer-events-none" />}

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-xl text-white shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-heading">Zentro Drive Camera</h3>
              <p className="text-[11px] text-slate-400">
                Saves directly to your default <strong className="text-brand-300">Camera</strong> folder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {videoDevices.length > 1 && !capturedPhotoUrl && !recordedVideoUrl && (
              <button
                onClick={handleSwitchCamera}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Switch Camera Device"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera Viewport Area */}
        <div className="flex-1 bg-black relative flex items-center justify-center min-h-[380px]">
          {loading && (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mb-3" />
              <p className="text-xs font-medium">Starting Camera & Sensors...</p>
            </div>
          )}

          {error && (
            <div className="p-6 text-center text-rose-400 max-w-md">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-400" />
              <p className="text-sm font-bold mb-1">Camera Permission Blocked</p>
              <p className="text-xs text-rose-300/80 mb-4">{error}</p>
            </div>
          )}

          {/* Live Video Preview Stream */}
          {!capturedPhotoUrl && !recordedVideoUrl && !error && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[460px]"
              />

              {/* Live Recording HUD Status */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-rose-600/90 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-mono font-bold animate-pulse z-20">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>REC {formatTime(recordingSeconds)}</span>
                </div>
              )}

              {/* Mode Toggle Switcher */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-1 rounded-full border border-slate-800 shadow-xl z-20">
                <button
                  onClick={() => {
                    if (!isRecording) {
                      setMode('photo');
                      handleRetake();
                    }
                  }}
                  disabled={isRecording}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    mode === 'photo'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Photo</span>
                </button>
                <button
                  onClick={() => {
                    if (!isRecording) {
                      setMode('video');
                      handleRetake();
                    }
                  }}
                  disabled={isRecording}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    mode === 'video'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video</span>
                </button>
              </div>
            </>
          )}

          {/* Captured Photo Preview */}
          {capturedPhotoUrl && (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <img
                src={capturedPhotoUrl}
                alt="Captured Snapshot"
                className="w-full h-full object-contain max-h-[460px]"
              />
              <span className="absolute top-4 left-4 bg-emerald-500/80 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md">
                Photo Snapshot Preview
              </span>
            </div>
          )}

          {/* Recorded Video Preview */}
          {recordedVideoUrl && (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <video
                src={recordedVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain max-h-[460px]"
              />
              <span className="absolute top-4 left-4 bg-purple-500/80 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md">
                Recorded Video Preview
              </span>
            </div>
          )}
        </div>

        {/* Modal Shutter & Action Footer */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-4">
          {/* Default Camera Info */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FolderCheck className="w-4 h-4 text-emerald-400" />
            <span>Target: <strong className="text-slate-200 font-semibold">/Camera</strong></span>
          </div>

          {/* Action Shutter Controls */}
          <div className="flex items-center gap-3">
            {/* Live Camera Actions */}
            {!capturedPhotoUrl && !recordedVideoUrl && (
              <>
                {mode === 'photo' ? (
                  <button
                    onClick={handleSnapPhoto}
                    disabled={loading || !!error}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-full text-xs font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Circle className="w-4 h-4 fill-white" />
                    <span>Snap Photo</span>
                  </button>
                ) : (
                  <>
                    {!isRecording ? (
                      <button
                        onClick={handleStartRecording}
                        disabled={loading || !!error}
                        className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-bold shadow-lg shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Circle className="w-4 h-4 fill-white animate-pulse" />
                        <span>Start Recording</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStopRecording}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-rose-500/50 rounded-full text-xs font-bold shadow-lg transition-all active:scale-95"
                      >
                        <Square className="w-4 h-4 fill-rose-500 text-rose-500" />
                        <span>Stop Recording</span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {/* Media Review Actions (Retake vs Save to Camera Folder) */}
            {(capturedPhotoUrl || recordedVideoUrl) && (
              <>
                <button
                  onClick={handleRetake}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                >
                  Retake
                </button>
                <button
                  onClick={handleSaveToCameraFolder}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving to Camera Folder...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save to Camera Folder</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
