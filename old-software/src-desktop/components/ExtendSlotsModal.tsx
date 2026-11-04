import React, { useState } from 'react';
import { Clock, Plus, X, Zap, Check, AlertCircle } from 'lucide-react';
import { Doctor, Shift } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ExtendSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor?: Doctor;
  shift?: Shift;
  onSlotsUpdated: () => void;
}

export const ExtendSlotsModal: React.FC<ExtendSlotsModalProps> = ({
  isOpen,
  onClose,
  doctor,
  shift,
  onSlotsUpdated,
}) => {
  const { user } = useAuth();
  const [startTime, setStartTime] = useState(shift?.start_time || '08:00');
  const [endTime, setEndTime] = useState(shift?.end_time || '22:00');
  const [duration, setDuration] = useState(shift?.slot_duration_minutes || 9);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !shift) return null;

  const actorUser = { id: user?.id || 'admin', username: user?.username || 'admin', role: user?.role || 'admin' };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await api.updateShift({
        id: shift.id,
        updates: {
          start_time: startTime,
          end_time: endTime,
          slot_duration_minutes: Number(duration),
        },
        actorUser,
      });
      onSlotsUpdated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update shift slots.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setQuickEnd = (time: string) => {
    setEndTime(time);
  };

  const setQuickDuration = (mins: number) => {
    setDuration(mins);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-950" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-950">
                Slot Management & Shift Hours
              </h3>
              <p className="text-[11px] font-semibold text-slate-900/80">
                {doctor?.name} — {shift.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-900 hover:bg-black/10 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block">Quick End Time Presets</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Till 10:00 PM (22:00)', time: '22:00' },
                { label: 'Till 11:00 PM (23:00)', time: '23:00' },
                { label: 'Till 12:00 AM (00:00)', time: '23:59' },
                { label: 'Till 8:00 PM (20:00)', time: '20:00' },
              ].map((p) => (
                <button
                  key={p.time}
                  type="button"
                  onClick={() => setQuickEnd(p.time)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition text-[11px] border ${
                    endTime === p.time
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slot Duration Presets */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block">Slot Interval (Minutes per Patient)</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '5 Mins (Max Slots)', mins: 5 },
                { label: '8 Mins', mins: 8 },
                { label: '9 Mins (Standard)', mins: 9 },
                { label: '10 Mins', mins: 10 },
                { label: '15 Mins', mins: 15 },
                { label: '20 Mins', mins: 20 },
              ].map((d) => (
                <button
                  key={d.mins}
                  type="button"
                  onClick={() => setQuickDuration(d.mins)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition text-[11px] border ${
                    duration === d.mins
                      ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Inputs */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block font-semibold mb-1 text-slate-600">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-600">End Time (24h)</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-amber-900 bg-amber-50/50"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-600">Slot Duration (Mins)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800">ℹ️ Slots Preview:</div>
            <div>
              Shifts running from <strong>{startTime}</strong> to <strong>{endTime}</strong> at <strong>{duration} min</strong> intervals will generate all slots dynamically.
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Updating Slots...' : 'Apply & Generate Slots'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
