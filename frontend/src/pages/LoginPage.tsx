import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HardDrive, ArrowRight, Phone, KeyRound, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('+1234567890');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const handleSendPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestOtp(phone);
      if (res.devCode) setDevCode(res.devCode);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-100">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 animate-pop-in">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-xl shadow-brand-500/25 mb-4 text-white">
            <HardDrive className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Zentro Drive</h1>
          <p className="text-xs text-slate-400 mt-1">Cloud Storage Platform by Failed Engineers</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 text-center">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendPhone} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700/70 focus:border-brand-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl font-semibold text-xs text-white shadow-lg shadow-brand-500/25 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">WhatsApp Verification Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit WhatsApp OTP"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700/70 focus:border-brand-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 tracking-widest font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
              {devCode && (
                <p className="text-[11px] text-brand-400 mt-2 text-center">
                  Dev OTP Code: <strong className="font-mono">{devCode}</strong> (or default <strong className="font-mono">123456</strong>)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !otp.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl font-semibold text-xs text-white shadow-lg shadow-brand-500/25 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-200 mt-2"
            >
              Back to Mobile Number
            </button>
          </form>
        )}

        <div className="mt-8 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            Designed & Built by <span className="text-slate-300 font-semibold">Failed Engineers</span>
          </p>
        </div>
      </div>
    </div>
  );
};
