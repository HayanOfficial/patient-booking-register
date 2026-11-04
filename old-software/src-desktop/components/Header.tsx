import React from 'react';
import { CheckSquare, LogOut, User as UserIcon, Shield, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

interface HeaderProps {
  currentDate: string;
}

export const Header: React.FC<HeaderProps> = ({ currentDate }) => {
  const { user, logout } = useAuth();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <header className="bg-[#0F1629] text-white px-6 py-3 border-b border-[#1E2D45] shadow-md flex items-center justify-between">
      {/* Left Title & Subtitle */}
      <div className="flex flex-col">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-sans">
          Patient Booking Register
        </h1>
        <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-0.5">
          <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
          <span>Real-time schedule and patient coordination center</span>
        </div>
      </div>

      {/* Right Controls & User Info */}
      <div className="flex items-center gap-4">
        {/* Date Display */}
        <div className="text-right flex flex-col items-end">
          <span className="text-xs font-semibold text-slate-200 tracking-wider font-mono">
            {currentDate || todayStr}
          </span>
          <div className="bg-teal-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 mt-0.5 shadow-sm">
            <Clock className="w-3 h-3 text-slate-900" />
            <span>Dashboard View</span>
          </div>
        </div>

        {/* User Role Badge & Logout */}
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
            <div className="flex items-center gap-2 bg-[#1E2D45] px-3 py-1.5 rounded-lg border border-teal-800/50">
              <div className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs">
                {user.role === 'admin' ? <Shield className="w-4 h-4 text-teal-300" /> : <UserIcon className="w-4 h-4 text-teal-300" />}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-100 leading-tight">{user.full_name}</span>
                <span className="text-[10px] text-teal-400 uppercase font-semibold tracking-wider">
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
