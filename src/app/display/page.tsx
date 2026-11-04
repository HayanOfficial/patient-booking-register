'use client';

import React, { useState, useEffect } from 'react';
import { Stethoscope, Users } from 'lucide-react';
import { Booking } from '../../types';
import { api } from '../../services/api';
import { getTodayDateString } from '../../utils/dateUtils';

export default function NowServingDisplay() {
  const [currentDate, setCurrentDate] = useState('2026-09-29');
  const [currentTime, setCurrentTime] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeDoctor, setActiveDoctor] = useState<string>('Dr Naeem Khattak');

  useEffect(() => {
    setCurrentDate(getTodayDateString());
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const docs = await api.getActiveDoctors();
      if (docs.length > 0) {
        setActiveDoctor(docs[0].name);
        const shifts = await api.getShifts(docs[0].id);
        if (shifts.length > 0) {
          const list = await api.getBookingsForShiftAndDate(currentDate, docs[0].id, shifts[0].id);
          setBookings(list);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = api.subscribeToRealtime(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [currentDate]);

  // Current In-Process or latest Checked-In Token
  const nowServing = bookings.find((b) => b.status === 'in_process') || bookings.find((b) => b.status === 'checked_in') || null;

  // Next in Queue
  const nextInQueue = bookings
    .filter((b) => b.status === 'checked_in' && b.id !== nowServing?.id)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col p-8 font-sans select-none">
      {/* Top Banner */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Dr Naeem Eye Laser & Retina Center
            </h1>
            <p className="text-sm text-slate-400 font-medium">
              Queue & Token Announcement Display &bull; {activeDoctor}
            </p>
          </div>
        </div>

        {/* Live Clock */}
        <div className="text-right">
          <div className="text-3xl font-mono font-black text-amber-400">{currentTime}</div>
          <div className="text-xs text-slate-400 font-semibold">{currentDate} (Asia/Karachi)</div>
        </div>
      </header>

      {/* Main Display Body */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-8">
        {/* Left: Giant NOW SERVING Board */}
        <div className="lg:col-span-8 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-amber-500/60 rounded-3xl p-10 shadow-2xl flex flex-col justify-between min-h-[480px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-400 font-black text-sm tracking-wider uppercase border border-amber-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>NOW SERVING</span>
            </div>
            <div className="text-slate-400 text-sm font-semibold">Consultation Room 1</div>
          </div>

          <div className="text-center my-8">
            <div className="text-8xl sm:text-9xl font-black font-mono tracking-widest text-amber-400 drop-shadow-md">
              {nowServing ? nowServing.token_code : '---'}
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-4">
              {nowServing?.patient
                ? `${nowServing.patient.first_name} ${nowServing.patient.last_name || ''}`
                : 'Waiting for Patient'}
            </div>
            <div className="text-base text-slate-400 mt-1 font-mono">
              {nowServing?.patient?.patient_mrn ? `MRN: ${nowServing.patient.patient_mrn}` : ''}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-6 text-sm text-slate-400">
            <div>
              Slot: <strong>{nowServing?.slot_time_formatted || '--:--'}</strong>
            </div>
            <div>
              Type: <strong>{nowServing?.reservation_type || 'Appointment'}</strong>
            </div>
            <div>
              Doctor: <strong>{nowServing?.doctor_name || activeDoctor}</strong>
            </div>
          </div>
        </div>

        {/* Right: NEXT IN QUEUE */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col h-full min-h-[480px]">
          <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider mb-6 pb-3 border-b border-slate-800">
            <Users className="w-4 h-4 text-blue-400" />
            <span>Next In Line (Please Be Ready)</span>
          </div>

          <div className="flex-1 space-y-4">
            {nextInQueue.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs text-center">
                No checked-in patients waiting in queue.
              </div>
            ) : (
              nextInQueue.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-mono text-xl font-black text-amber-400">
                        {item.token_code}
                      </div>
                      <div className="text-xs font-semibold text-slate-200">
                        {item.patient?.first_name} {item.patient?.last_name || ''}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-mono text-slate-400 font-bold">
                    {item.slot_time_formatted}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
            Queue updates in real-time as tokens are called.
          </div>
        </div>
      </main>
    </div>
  );
}
