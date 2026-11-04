import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, UserCheck } from 'lucide-react';
import { Doctor, Shift } from '../types';
import { formatDateForDisplay, addDaysToDate } from '../utils/dateUtils';

interface DateDoctorShiftSelectorProps {
  currentDate: string;
  onDateChange: (newDate: string) => void;
  doctors: Doctor[];
  selectedDoctorId: string;
  onDoctorChange: (doctorId: string) => void;
  shifts: Shift[];
  selectedShiftId: string;
  onShiftChange: (shiftId: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onOpenExtendSlots?: () => void;
}

export const DateDoctorShiftSelector: React.FC<DateDoctorShiftSelectorProps> = ({
  currentDate,
  onDateChange,
  doctors,
  selectedDoctorId,
  onDoctorChange,
  shifts,
  selectedShiftId,
  onShiftChange,
  onRefresh,
  isRefreshing,
  onOpenExtendSlots,
}) => {
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
  const selectedShift = shifts.find((s) => s.id === selectedShiftId) || shifts[0];

  const handlePrevDay = () => {
    onDateChange(addDaysToDate(currentDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(addDaysToDate(currentDate, 1));
  };

  return (
    <div className="bg-white px-6 py-3.5 border-b border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
      {/* Left: Date Navigator & Doctor/Shift Dropdown */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Navigate Date Box */}
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-slate-500 mb-1">Navigate Date</label>
          <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 shadow-xs hover:border-amber-400 transition-colors">
            <button
              onClick={handlePrevDay}
              title="Previous Day"
              className="p-1 text-slate-500 hover:text-teal-600 hover:bg-slate-200 rounded transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="relative flex items-center mx-2">
              <input
                type="date"
                value={currentDate}
                onChange={(e) => e.target.value && onDateChange(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
              />
            </div>
            <button
              onClick={handleNextDay}
              title="Next Day"
              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-200 rounded transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Doctor & Shift Selector Box */}
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
            <span>Select Doctor & Shift</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative min-w-[280px]">
              <select
                value={`${selectedDoctorId}:${selectedShiftId}`}
                onChange={(e) => {
                  const [docId, sId] = e.target.value.split(':');
                  if (docId !== selectedDoctorId) onDoctorChange(docId);
                  if (sId !== selectedShiftId) onShiftChange(sId);
                }}
                className="w-full bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-800 rounded-lg px-3 py-2 pr-8 shadow-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
              >
                {doctors.map((doc) => (
                  <optgroup key={doc.id} label={doc.name}>
                    {shifts
                      .filter((s) => s.doctor_id === doc.id)
                      .map((shift) => (
                        <option key={shift.id} value={`${doc.id}:${shift.id}`}>
                          {doc.name} — {shift.name} ({shift.start_time}-{shift.end_time})
                        </option>
                      ))}
                    {shifts.filter((s) => s.doctor_id === doc.id).length === 0 && (
                      <option value={`${doc.id}:default`}>{doc.name} — Default Shift</option>
                    )}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Update Register Button */}
            <button
              onClick={onRefresh}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Update Register</span>
            </button>

            {/* Adjust / Add Slots Button */}
            {onOpenExtendSlots && (
              <button
                onClick={onOpenExtendSlots}
                title="Adjust shift hours, slot intervals, or extend slots till 10 PM and beyond"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
              >
                <span>⚙️ Adjust / Add Slots</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Doctor Profile Card */}
      {selectedDoctor && (
        <div className="flex items-center gap-3 bg-amber-50/70 border border-amber-200/80 px-4 py-2 rounded-xl shadow-xs">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 border-2 border-white shadow-xs flex items-center justify-center text-slate-800 font-bold">
            <UserCheck className="w-6 h-6 text-amber-900" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900">{selectedDoctor.name}</span>
            <span className="text-[11px] text-amber-800 font-medium">
              {selectedShift?.name || 'Default Shift'} ({selectedShift?.start_time || '08:00'} - {selectedShift?.end_time || '18:00'})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
