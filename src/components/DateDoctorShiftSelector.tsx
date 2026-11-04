'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, UserCheck } from 'lucide-react';
import { Doctor, Shift } from '../types';
import { addDays, formatDateDisplay } from '../utils/dateUtils';

interface DateDoctorShiftSelectorProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  doctors: Doctor[];
  selectedDoctorId: string;
  onDoctorChange: (doctorId: string) => void;
  shifts: Shift[];
  selectedShiftId: string;
  onShiftChange: (shiftId: string) => void;
  onUpdateRegister: () => void;
  isUpdating: boolean;
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
  onUpdateRegister,
  isUpdating,
}) => {
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  const handlePrevDay = () => onDateChange(addDays(currentDate, -1));
  const handleNextDay = () => onDateChange(addDays(currentDate, 1));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 flex flex-wrap items-center justify-between gap-4">
      {/* 1. Date Navigator */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-slate-500 tracking-wide">
          Navigate Date
        </label>
        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50/60 shadow-xs h-10">
          <button
            onClick={handlePrevDay}
            className="px-2.5 h-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors flex items-center justify-center border-r border-slate-300"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3">
            <span className="font-mono text-xs font-bold text-slate-800 tracking-wider">
              {formatDateDisplay(currentDate)}
            </span>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              className="w-5 h-5 opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-none focus:outline-hidden"
              title="Pick Date"
            />
          </div>

          <button
            onClick={handleNextDay}
            className="px-2.5 h-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors flex items-center justify-center border-l border-slate-300"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Doctor & Shift Dropdown + Update Register Button */}
      <div className="flex flex-col gap-1 flex-1 min-w-[280px] max-w-xl">
        <label className="text-[11px] font-semibold text-slate-500 tracking-wide">
          Select Doctor & Shift
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-500">
              <UserCheck className="w-4 h-4" />
            </div>
            <select
              value={`${selectedDoctorId}::${selectedShiftId}`}
              onChange={(e) => {
                const [docId, shiftId] = e.target.value.split('::');
                onDoctorChange(docId);
                onShiftChange(shiftId);
              }}
              className="w-full pl-9 pr-8 h-10 bg-slate-50/60 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-xs cursor-pointer truncate"
            >
              {doctors.map((doc) => {
                const docShifts = shifts.filter((s) => s.doctor_id === doc.id);
                if (docShifts.length === 0) {
                  return (
                    <option key={doc.id} value={`${doc.id}::`}>
                      {doc.name} — No Shift Configured
                    </option>
                  );
                }
                return docShifts.map((s) => (
                  <option key={`${doc.id}-${s.id}`} value={`${doc.id}::${s.id}`}>
                    {doc.name} — {s.name}
                  </option>
                ));
              })}
            </select>
          </div>

          {/* Update Register Button matching screenshot yellow #F59E0B */}
          <button
            onClick={onUpdateRegister}
            disabled={isUpdating}
            className="h-10 px-4 bg-[#F59E0B] hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>Update Register</span>
          </button>
        </div>
      </div>

      {/* 3. Doctor Profile Card */}
      <div className="flex items-center gap-3 bg-amber-50/50 border border-amber-200/80 rounded-xl px-4 py-2 shadow-xs">
        <div className="w-9 h-9 rounded-full bg-amber-200/80 border border-amber-300 flex items-center justify-center text-amber-800 font-bold text-sm">
          👨‍⚕️
        </div>
        <div>
          <div className="text-xs font-bold text-slate-900">
            {selectedDoctor?.name || 'Dr Naeem Khattak'}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {selectedDoctor?.specialty || 'Consultant Specialist'}
          </div>
        </div>
      </div>
    </div>
  );
};
