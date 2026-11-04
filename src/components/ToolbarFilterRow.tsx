'use client';

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search, Globe, Trash2 } from 'lucide-react';
import { getTodayDateString, addDays } from '../utils/dateUtils';

interface ToolbarFilterRowProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
}

export const ToolbarFilterRow: React.FC<ToolbarFilterRowProps> = ({
  currentDate,
  onDateChange,
  searchQuery,
  onSearchChange,
  onClearFilters,
}) => {
  const isToday = currentDate === getTodayDateString();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      {/* Left: Schedule Navigation with Today button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-1">
          <Calendar className="w-4 h-4 text-amber-500" />
          <span>Schedule</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onDateChange(addDays(currentDate, -1))}
            className="p-1.5 text-slate-500 hover:text-slate-900 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDateChange(getTodayDateString())}
            className={`px-3 py-1 text-xs font-bold rounded-lg shadow-xs transition-all ${
              isToday
                ? 'bg-[#F59E0B] text-slate-950 shadow-amber-500/20'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-amber-50'
            }`}
          >
            Today
          </button>

          <button
            onClick={() => onDateChange(addDays(currentDate, 1))}
            className="p-1.5 text-slate-500 hover:text-slate-900 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Quick Search and tool icons */}
      <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
        <div className="relative w-full max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Quick find patient, phone or..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-xs"
          />
        </div>

        <button
          onClick={onClearFilters}
          className="p-2 text-slate-400 hover:text-slate-700 bg-white border border-slate-300 rounded-xl shadow-xs hover:bg-slate-50 transition-colors"
          title="Reset Search and Filters"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
