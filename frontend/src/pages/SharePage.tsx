import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest, getFileRawUrl } from '../services/api';
import { HardDrive, Download, Lock, FileText, AlertCircle } from 'lucide-react';

export const SharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);

  const fetchSharedItem = async (pass?: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (pass) headers['x-share-password'] = pass;

      const res = await apiRequest(`/share/${token}`, { headers });
      if (res.requiresPassword) {
        setRequiresPassword(true);
      } else {
        setRequiresPassword(false);
        setSharedData(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load shared link.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchSharedItem();
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSharedItem(password);
  };

  const handleDownload = () => {
    const downloadUrl = `/api/share/${token}/download`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = sharedData?.file?.name || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl animate-pop-in">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 rounded-2xl bg-brand-600 text-white mb-3">
            <HardDrive className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold font-heading">TeleDrive Shared File</h2>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Verifying link...</div>
        ) : error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : requiresPassword ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>This link is password protected.</span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-xs font-semibold text-white transition-colors"
            >
              Access File
            </button>
          </form>
        ) : sharedData?.file ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-full h-32 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center mb-4 overflow-hidden">
              {sharedData.file.mimeType?.startsWith('image/') ? (
                <img
                  src={getFileRawUrl(sharedData.file.id)}
                  alt={sharedData.file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FileText className="w-12 h-12 text-brand-400" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-100 mb-1" title={sharedData.file.name}>
              {sharedData.file.name}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Permission: <span className="font-semibold text-brand-400">{sharedData.permission}</span>
            </p>
            {sharedData.permission !== 'VIEWER' && (
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-500/20"
              >
                <Download className="w-4 h-4" />
                Download Shared File
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">File not available.</div>
        )}
      </div>
    </div>
  );
};
