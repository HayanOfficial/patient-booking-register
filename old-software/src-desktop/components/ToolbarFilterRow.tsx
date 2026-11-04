import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search, Globe, RotateCcw } from 'lucide-react';
import { getTodayDateString, addDaysToDate } from '../utils/dateUtils';

interface ToolbarFilterRowProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
}

export const ToolbarFilterRow: React.FC<ToolbarFilterRowProps> = ({
  currentDate,
  onDateChange,
  searchQuery,
  onSearchChange,
  onResetFilters,
}) => {
  const isToday = currentDate === getTodayDateString();

  return (
    <div className="bg-[#F8FAFC] px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
      {/* Left: Schedule and Today navigation */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs">
          <Calendar className="w-3.5 h-3.5 text-amber-600" />
          <span>Schedule</span>
        </div>

        <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
          <button
            onClick={() => onDateChange(addDaysToDate(currentDate, -1))}
            title="Previous Day"
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onDateChange(getTodayDateString())}
            className={`px-3 py-1 text-xs font-bold rounded-md transition ${
              isToday
                ? 'bg-[#F59E0B] text-slate-950 shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Today
          </button>

          <button
            onClick={() => onDateChange(addDaysToDate(currentDate, 1))}
            title="Next Day"
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Quick Search and Tools */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Quick find patient, phone or..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-72 bg-white border border-slate-300 text-xs text-slate-800 pl-9 pr-3 py-1.5 rounded-full shadow-xs focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-hidden placeholder-slate-400"
          />
        </div>

        <button
          title="Language: English / Urdu"
          className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded-full hover:bg-slate-50 shadow-xs transition"
        >
          <Globe className="w-4 h-4" />
        </button>

        <button
          onClick={onResetFilters}
          title="Reset Search and Filters"
          className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded-full hover:bg-slate-50 shadow-xs transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
