'use client';

import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Wifi,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, isLoading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [karachiTime, setKarachiTime] = useState<string>('');

  // Live Karachi Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setKarachiTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setErrorMsg(result.error || 'Invalid credentials. Please verify and try again.');
      } else {
        onLoginSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login failed. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick fill helper for multi-role testing
  const handleQuickLogin = async (userRole: UserRole) => {
    const credentials: Record<UserRole, { u: string; p: string }> = {
      admin: { u: 'admin', p: 'admin123' },
      operator: { u: 'operator', p: 'operator123' },
      receptionist: { u: 'receptionist', p: 'reception123' },
    };

    const cred = credentials[userRole];
    setUsername(cred.u);
    setPassword(cred.p);
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const result = await login(cred.u, cred.p);
      if (!result.success) {
        setErrorMsg(result.error || 'Login failed.');
      } else {
        onLoginSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E252B] to-[#0A0F14] flex flex-col justify-between p-4 sm:p-6 text-slate-100 font-sans select-none">
      {/* Top Bar with Live Indicator & Timezone */}
      <header className="flex items-center justify-between max-w-5xl w-full mx-auto py-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-300">Supabase Realtime Cloud Engine</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60 shadow-xs">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{karachiTime || 'Loading...'} (Asia/Karachi)</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md bg-[#182026] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Card Header */}
          <div className="p-8 pb-6 text-center border-b border-slate-700/50 bg-[#1D272F]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
              <Stethoscope className="w-9 h-9" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Dr Naeem Eye Laser & Retina Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
              Patient Booking Register (HIMS Front-Desk)
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] font-semibold text-slate-300 mt-3">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Restricted System &bull; Staff Authentication Only</span>
            </div>
          </div>

          {/* Form */}
          <div className="p-8 pt-6">
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="flex-1 font-medium">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Username or Staff Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin or operator"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0F172A] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0F172A] border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || authLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting || authLoading ? (
                    <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Booking Sheet</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Public Registration Notice */}
            <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-800/80 pt-4">
              <p>
                No public signup. Staff accounts are provisioned exclusively by the System Administrator.
              </p>
            </div>

            {/* Quick 1-Click Role Testing Access */}
            <div className="mt-6 bg-[#111820] border border-slate-700/60 rounded-2xl p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center justify-between">
                <span>1-Click Test Role Login:</span>
                <span className="text-[10px] text-slate-400 font-normal">Pre-configured</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin')}
                  disabled={isSubmitting}
                  className="px-2.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer"
                  title="Administrator (Full Access & All Tabs)"
                >
                  <span className="text-rose-400 text-[10px] uppercase">Admin</span>
                  <span className="text-[10px] text-slate-400 font-mono">admin123</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('operator')}
                  disabled={isSubmitting}
                  className="px-2.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer"
                  title="Call Operator (Appointments & Leads)"
                >
                  <span className="text-blue-400 text-[10px] uppercase">Operator</span>
                  <span className="text-[10px] text-slate-400 font-mono">operator123</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('receptionist')}
                  disabled={isSubmitting}
                  className="px-2.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer"
                  title="Front Desk Receptionist (Check-in, Tokens, Walk-ins)"
                >
                  <span className="text-emerald-400 text-[10px] uppercase">Reception</span>
                  <span className="text-[10px] text-slate-400 font-mono">reception123</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-slate-500 py-3">
        <span>Dr Naeem Eye Laser & Retina Center &bull; Peshawar, Pakistan &bull; Vercel & Supabase Realtime Architecture</span>
      </footer>
    </div>
  );
};

