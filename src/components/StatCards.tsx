'use client';

import React from 'react';
import { ListFilter } from 'lucide-react';
import { DailyStatCardsData, StatCardFilter } from '../types';

interface StatCardsProps {
  stats: DailyStatCardsData | null;
  activeFilter: StatCardFilter;
  onFilterChange: (filter: StatCardFilter) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  stats,
  activeFilter,
  onFilterChange,
}) => {
  if (!stats) return null;

  return (
    <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 pt-1 no-scrollbar select-none">
      {/* 1. SHOW ALL Card */}
      <button
        onClick={() => onFilterChange('all')}
        className={`min-w-[100px] flex-shrink-0 px-3 py-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'all'
            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400'
            : 'bg-white text-slate-700 border-slate-200/90 hover:border-amber-400 hover:bg-amber-50/30'
        }`}
      >
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          SHOW ALL
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-slate-800">
          <ListFilter className="w-5 h-5 text-amber-600" />
        </div>
      </button>

      {/* 2. TOTAL BOOKINGS Card */}
      <button
        onClick={() => onFilterChange('all')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'all'
            ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-300'
            : 'bg-white border-amber-200/80 hover:border-amber-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
          TOTAL BOOKINGS
        </div>
        <div className="text-2xl font-black text-amber-600 tracking-tight leading-none my-1">
          {stats.totalBookings}
        </div>
        <div className="text-[10px] text-slate-400 font-medium">Shift Total</div>
      </button>

      {/* 3. BOOKED SLOTS Card */}
      <button
        onClick={() => onFilterChange('booked')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'booked'
            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-300'
            : 'bg-white border-blue-200/80 hover:border-blue-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
          BOOKED SLOTS
        </div>
        <div className="text-xl font-black text-blue-600 tracking-tight leading-none my-1">
          {stats.bookedSlots}/{stats.totalSlots}
        </div>
        <div className="text-[10px] text-blue-500 font-semibold">{stats.bookedPercentage}%</div>
      </button>

      {/* 4. AVAILABLE Card */}
      <button
        onClick={() => onFilterChange('available')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'available'
            ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-300'
            : 'bg-white border-purple-200/80 hover:border-purple-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-800">
          AVAILABLE
        </div>
        <div className="text-2xl font-black text-purple-600 tracking-tight leading-none my-1">
          {stats.availableSlots}
        </div>
        <div className="text-[10px] text-purple-500 font-semibold">{stats.availablePercentage}%</div>
      </button>

      {/* 5. CHECK-IN Card */}
      <button
        onClick={() => onFilterChange('checked_in')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'checked_in'
            ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-300'
            : 'bg-white border-emerald-200/80 hover:border-emerald-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
          CHECK-IN
        </div>
        <div className="text-2xl font-black text-emerald-600 tracking-tight leading-none my-1">
          {stats.checkInCount}
        </div>
        <div className="text-[10px] text-emerald-600 font-semibold">{stats.checkInPercentage}%</div>
      </button>

      {/* 6. IN PROCESS Card */}
      <button
        onClick={() => onFilterChange('in_process')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'in_process'
            ? 'bg-cyan-50/80 border-cyan-500 ring-2 ring-cyan-300'
            : 'bg-white border-cyan-200/80 hover:border-cyan-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-800">
          IN PROCESS
        </div>
        <div className="text-2xl font-black text-cyan-600 tracking-tight leading-none my-1">
          {stats.inProcessCount}
        </div>
        <div className="text-[10px] text-cyan-500 font-semibold">{stats.inProcessPercentage}%</div>
      </button>

      {/* 7. PENDING Card */}
      <button
        onClick={() => onFilterChange('pending')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'pending'
            ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-300'
            : 'bg-white border-amber-200/80 hover:border-amber-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
          PENDING
        </div>
        <div className="text-2xl font-black text-amber-500 tracking-tight leading-none my-1">
          {stats.pendingCount}
        </div>
        <div className="text-[10px] text-amber-600 font-semibold">{stats.pendingPercentage}%</div>
      </button>

      {/* 8. ABSENT Card */}
      <button
        onClick={() => onFilterChange('absent')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'absent'
            ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-300'
            : 'bg-white border-rose-200/80 hover:border-rose-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800">
          ABSENT
        </div>
        <div className="text-2xl font-black text-rose-600 tracking-tight leading-none my-1">
          {stats.absentCount}
        </div>
        <div className="text-[10px] text-rose-500 font-semibold">{stats.absentPercentage}%</div>
      </button>

      {/* 9. FOLLOW-UP Card */}
      <button
        onClick={() => onFilterChange('follow_up')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'follow_up'
            ? 'bg-teal-50/80 border-teal-500 ring-2 ring-teal-300'
            : 'bg-white border-teal-200/80 hover:border-teal-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800">
          FOLLOW-UP
        </div>
        <div className="text-2xl font-black text-teal-600 tracking-tight leading-none my-1">
          {stats.followUpCount}
        </div>
        <div className="text-[10px] text-teal-500 font-semibold">{stats.followUpPercentage}%</div>
      </button>

      {/* 10. REMAINING FU Card */}
      <button
        onClick={() => onFilterChange('remaining_fu')}
        className={`min-w-[115px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
          activeFilter === 'remaining_fu'
            ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-300'
            : 'bg-white border-rose-200/80 hover:border-rose-400'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800">
          REMAINING FU
        </div>
        <div className="text-2xl font-black text-rose-600 tracking-tight leading-none my-1">
          {stats.remainingFollowUpCount}
        </div>
        <div className="text-[10px] text-rose-500 font-semibold">{stats.remainingFollowUpPercentage}%</div>
      </button>

      {/* 11. Acquisition Source Cards */}
      {Object.entries(stats.sourcesCount).map(([srcName, count]) => {
        const isSelected = activeFilter === `source:${srcName}`;
        return (
          <button
            key={srcName}
            onClick={() => onFilterChange(isSelected ? 'all' : `source:${srcName}`)}
            className={`min-w-[100px] flex-shrink-0 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all shadow-xs cursor-pointer ${
              isSelected
                ? 'bg-amber-100/90 border-amber-500 ring-2 ring-amber-400'
                : 'bg-white border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 truncate">
              {srcName}
            </div>
            <div className="text-2xl font-black text-slate-800 tracking-tight leading-none my-1">
              {count}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Patients</div>
          </button>
        );
      })}
    </div>
  );
};
