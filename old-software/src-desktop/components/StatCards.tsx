import React from 'react';
import { ListFilter } from 'lucide-react';
import { DailyStatCardsData } from '../types';

export type StatCardFilter =
  | 'all'
  | 'booked'
  | 'available'
  | 'checked_in'
  | 'in_process'
  | 'pending'
  | 'absent'
  | 'follow_up'
  | 'remaining_fu'
  | string; // For source filters like 'source:Self', 'source:Facebook'

interface StatCardsProps {
  stats: DailyStatCardsData | null;
  activeFilter: StatCardFilter;
  onSelectFilter: (filter: StatCardFilter) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({ stats, activeFilter, onSelectFilter }) => {
  if (!stats) return null;

  return (
    <div className="bg-[#F8FAFC] px-6 py-2 border-b border-slate-200">
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar select-none">
        {/* SHOW ALL */}
        <button
          onClick={() => onSelectFilter('all')}
          className={`flex flex-col justify-between min-w-[84px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'all'
              ? 'bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-slate-800'
              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-bold tracking-wider uppercase">SHOW ALL</span>
          <ListFilter className={`w-5 h-5 ${activeFilter === 'all' ? 'text-amber-400' : 'text-slate-600'}`} />
        </button>

        {/* TOTAL BOOKINGS */}
        <button
          onClick={() => onSelectFilter('booked')}
          className={`flex flex-col justify-between min-w-[100px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'booked'
              ? 'bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-400'
              : 'bg-white border-amber-300/80 hover:border-amber-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-amber-700 tracking-wider uppercase">TOTAL BOOKINGS</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-amber-600 font-mono leading-none">{stats.totalBookings}</span>
          </div>
        </button>

        {/* BOOKED SLOTS */}
        <button
          onClick={() => onSelectFilter('booked')}
          className={`flex flex-col justify-between min-w-[100px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'booked'
              ? 'bg-blue-50 border-blue-500 shadow-sm ring-2 ring-blue-400'
              : 'bg-white border-blue-300/80 hover:border-blue-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-blue-700 tracking-wider uppercase">BOOKED SLOTS</span>
          <div className="flex flex-col">
            <span className="text-base font-black text-blue-700 font-mono leading-tight">
              {stats.bookedSlots}/{stats.totalSlots}
            </span>
            <span className="text-[10px] text-blue-500 font-bold leading-none">{stats.bookedPercentage}%</span>
          </div>
        </button>

        {/* AVAILABLE */}
        <button
          onClick={() => onSelectFilter('available')}
          className={`flex flex-col justify-between min-w-[95px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'available'
              ? 'bg-purple-50 border-purple-500 shadow-sm ring-2 ring-purple-400'
              : 'bg-white border-purple-300/80 hover:border-purple-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-purple-700 tracking-wider uppercase">AVAILABLE</span>
          <div className="flex flex-col">
            <span className="text-xl font-black text-purple-700 font-mono leading-tight">{stats.availableSlots}</span>
            <span className="text-[10px] text-purple-500 font-bold leading-none">{stats.availablePercentage}%</span>
          </div>
        </button>

        {/* CHECK-IN */}
        <button
          onClick={() => onSelectFilter('checked_in')}
          className={`flex flex-col justify-between min-w-[95px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'checked_in'
              ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-400'
              : 'bg-white border-emerald-300/80 hover:border-emerald-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-emerald-700 tracking-wider uppercase">CHECK-IN</span>
          <div className="flex flex-col">
            <span className="text-xl font-black text-emerald-700 font-mono leading-tight">{stats.checkInCount}</span>
            <span className="text-[10px] text-emerald-600 font-bold leading-none">{stats.checkInPercentage}%</span>
          </div>
        </button>

        {/* IN PROCESS */}
        <button
          onClick={() => onSelectFilter('in_process')}
          className={`flex flex-col justify-between min-w-[95px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'in_process'
              ? 'bg-cyan-50 border-cyan-500 shadow-sm ring-2 ring-cyan-400'
              : 'bg-white border-cyan-300/80 hover:border-cyan-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-cyan-700 tracking-wider uppercase">IN PROCESS</span>
          <div className="flex flex-col">
            <span className="text-xl font-black text-cyan-700 font-mono leading-tight">{stats.inProcessCount}</span>
            <span className="text-[10px] text-cyan-600 font-bold leading-none">{stats.inProcessPercentage}%</span>
          </div>
        </button>

        {/* PENDING */}
        <button
          onClick={() => onSelectFilter('pending')}
          className={`flex flex-col justify-between min-w-[95px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'pending'
              ? 'bg-amber-100/70 border-amber-500 shadow-sm ring-2 ring-amber-400'
              : 'bg-white border-amber-300/80 hover:border-amber-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-amber-800 tracking-wider uppercase">PENDING</span>
          <div className="flex flex-col">
            <span className="text-xl font-black text-amber-700 font-mono leading-tight">{stats.pendingCount}</span>
            <span className="text-[10px] text-amber-600 font-bold leading-none">{stats.pendingPercentage}%</span>
          </div>
        </button>

        {/* ABSENT */}
        <button
          onClick={() => onSelectFilter('absent')}
          className={`flex flex-col justify-between min-w-[90px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'absent'
              ? 'bg-rose-50 border-rose-500 shadow-sm ring-2 ring-rose-400'
              : 'bg-white border-rose-300/80 hover:border-rose-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-rose-700 tracking-wider uppercase">ABSENT</span>
          <div className="flex flex-col">
            <span className="text-xl font-black text-rose-700 font-mono leading-tight">{stats.absentCount}</span>
            <span className="text-[10px] text-rose-500 font-bold leading-none">{stats.absentPercentage}%</span>
          </div>
        </button>

        {/* FOLLOW-UP */}
        <button
          onClick={() => onSelectFilter('follow_up')}
          className={`flex flex-col justify-between min-w-[95px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'follow_up'
              ? 'bg-teal-50 border-teal-500 shadow-sm ring-2 ring-teal-400'
              : 'bg-white border-teal-300/80 hover:border-teal-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-teal-700 tracking-wider uppercase">FOLLOW-UP</span>
          <div className="flex flex-col">
            <span className="text-xl font-black text-teal-700 font-mono leading-tight">{stats.followUpCount}</span>
            <span className="text-[10px] text-teal-600 font-bold leading-none">{stats.followUpPercentage}%</span>
          </div>
        </button>

        {/* REMAINING FU */}
        <button
          onClick={() => onSelectFilter('remaining_fu')}
          className={`flex flex-col justify-between min-w-[100px] h-[68px] p-2 rounded-xl border text-left transition-all ${
            activeFilter === 'remaining_fu'
              ? 'bg-pink-50 border-pink-500 shadow-sm ring-2 ring-pink-400'
              : 'bg-white border-pink-300/80 hover:border-pink-400 hover:shadow-xs'
          }`}
        >
          <span className="text-[10px] font-extrabold text-pink-700 tracking-wider uppercase">REMAINING FU</span>
          <div className="flex flex-col">
            <span className="text-xl font-black text-pink-700 font-mono leading-tight">{stats.remainingFollowUpCount}</span>
            <span className="text-[10px] text-pink-500 font-bold leading-none">{stats.remainingFollowUpPercentage}%</span>
          </div>
        </button>

        {/* Source Cards */}
        {Object.entries(stats.sourcesCount).map(([sourceName, count]) => {
          const filterKey = `source:${sourceName}`;
          const isSelected = activeFilter === filterKey;
          return (
            <button
              key={sourceName}
              onClick={() => onSelectFilter(filterKey)}
              className={`flex flex-col justify-between min-w-[85px] h-[68px] p-2 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-slate-800 text-white border-slate-900 shadow-sm ring-2 ring-slate-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <span className={`text-[10px] font-extrabold tracking-wider uppercase ${isSelected ? 'text-amber-400' : 'text-slate-500'}`}>
                {sourceName}
              </span>
              <span className="text-xl font-black font-mono leading-none">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
