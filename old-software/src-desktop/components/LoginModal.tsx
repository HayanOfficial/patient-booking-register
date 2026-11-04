import React, { useState } from 'react';
import { Lock, User, KeyRound, AlertCircle, Shield, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const LoginModal: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery Key mode
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await login(username, password);
    if (!res.success) {
      setErrorMsg(res.message || 'Invalid username or password.');
    }
    setIsSubmitting(false);
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (recoveryNewPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    try {
      const res = await api.resetWithRecoveryKey({
        recoveryKey: recoveryKey.trim(),
        newPassword: recoveryNewPassword,
      });

      if (res.success) {
        setRecoverySuccess(true);
        setTimeout(() => {
          setShowRecovery(false);
          setRecoverySuccess(false);
          setUsername('admin');
          setPassword(recoveryNewPassword);
        }, 1500);
      } else {
        setErrorMsg(res.message || 'Invalid recovery key.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Recovery failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Amber Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-6 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mx-auto mb-2 shadow-inner">
            <Lock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Patient Booking Register</h2>
          <p className="text-xs font-semibold text-teal-100/90 mt-0.5">
            Hospital Information Management System (HIMS) Front-Desk
          </p>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {recoverySuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Admin password successfully reset! Logging in...</span>
            </div>
          )}

          {!showRecovery ? (
            /* Normal Login Form */
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin or receptionist"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-98 disabled:opacity-50 mt-2"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In to Register'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setShowRecovery(true);
                  }}
                  className="text-[11px] text-slate-500 hover:text-amber-700 font-bold"
                >
                  Forgot Admin Password? (Use Recovery Key)
                </button>
              </div>


            </form>
          ) : (
            /* Emergency Recovery Key Reset Form */
            <form onSubmit={handleRecoverySubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900">
                Enter the one-time master recovery key generated during clinic setup to reset the Admin password.
              </div>

              <div>
                <label className="block mb-1">Master Recovery Key *</label>
                <input
                  type="text"
                  required
                  value={recoveryKey}
                  onChange={(e) => setRecoveryKey(e.target.value)}
                  placeholder="e.g. RECOVER-PBR-7849-AK92-X901"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block mb-1">New Admin Password *</label>
                <input
                  type="password"
                  required
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecovery(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md"
                >
                  Reset Admin
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
