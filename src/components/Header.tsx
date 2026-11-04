'use client';

import React from 'react';
import { Calendar, Stethoscope, Wifi, WifiOff, RefreshCw, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface HeaderProps {
  currentDate: string;
  realtimeStatus: 'connected' | 'reconnecting' | 'disconnected';
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  realtimeStatus,
  onRefresh,
  isRefreshing,
}) => {
  const { user, role, logout, switchUserRole } = useAuth();

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-rose-500 text-white',
    operator: 'bg-blue-500 text-white',
    receptionist: 'bg-emerald-500 text-white',
  };

  return (
    <header className="bg-[#1E252B] text-white px-6 py-2.5 shadow-md flex items-center justify-between border-b border-slate-700/60 select-none">
      {/* Left: Brand & Tagline */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <span>Patient Booking Register</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-normal">
            Real-time schedule and patient coordination center
          </p>
        </div>
      </div>

      {/* Right: Date Badge, Connection Status, Role Selector, User Menu */}
      <div className="flex items-center gap-3">
        {/* Realtime Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            realtimeStatus === 'connected'
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
              : realtimeStatus === 'reconnecting'
              ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
              : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
          }`}
          title={
            realtimeStatus === 'connected'
              ? 'Live Realtime Connected'
              : realtimeStatus === 'reconnecting'
              ? 'Reconnecting Realtime...'
              : 'Offline Mode'
          }
        >
          {realtimeStatus === 'connected' ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span className="capitalize">{realtimeStatus === 'connected' ? 'Live' : realtimeStatus}</span>
        </div>

        {/* Date Display Pill */}
        <div className="bg-[#2A343D] border border-slate-600/60 px-3 py-1 rounded-lg text-xs font-mono font-bold text-amber-400 tracking-wider">
          {currentDate}
        </div>

        {/* Refresh Register Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors"
          title="Reload schedule and statistics"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>

        {/* User Role Badge & Switcher for multi-role testing */}
        <div className="relative group">
          <div className="flex items-center gap-2 bg-[#2A343D] border border-slate-600/60 rounded-lg px-2.5 py-1 text-xs cursor-pointer hover:bg-slate-700/60 transition-colors">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                role ? roleColors[role] : 'bg-slate-600 text-white'
              }`}
            >
              {role || 'Guest'}
            </span>
            <span className="text-slate-200 font-semibold max-w-[120px] truncate">
              {user?.full_name || 'User'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>

          {/* Quick role switcher dropdown */}
          <div className="absolute right-0 mt-1 w-52 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 py-1 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3 py-2 border-b border-slate-100 text-[11px] text-slate-500 font-semibold uppercase">
              Switch Test Role
            </div>
            <button
              onClick={() => switchUserRole('admin')}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-amber-50 ${
                role === 'admin' ? 'text-amber-600 font-bold bg-amber-50/50' : 'text-slate-700'
              }`}
            >
              <span>Admin (Full Access)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">admin</span>
            </button>
            <button
              onClick={() => switchUserRole('operator')}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-amber-50 ${
                role === 'operator' ? 'text-amber-600 font-bold bg-amber-50/50' : 'text-slate-700'
              }`}
            >
              <span>Call Operator</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">operator</span>
            </button>
            <button
              onClick={() => switchUserRole('receptionist')}
              className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-amber-50 ${
                role === 'receptionist' ? 'text-amber-600 font-bold bg-amber-50/50' : 'text-slate-700'
              }`}
            >
              <span>Front Desk Receptionist</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">reception</span>
            </button>
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={logout}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated 1-Click Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
          title="Sign out of session"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
