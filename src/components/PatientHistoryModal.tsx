'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Patient, Booking } from '../types';
import { api } from '../services/api';

interface PatientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export const PatientHistoryModal: React.FC<PatientHistoryModalProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const [history, setHistory] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !patient) return;
    setIsLoading(true);
    api.getPatientHistory(patient.id)
      .then(setHistory)
      .finally(() => setIsLoading(false));
  }, [isOpen, patient]);

  if (!isOpen || !patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400/40 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {patient.first_name} {patient.last_name || ''}
              </h2>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="font-mono text-amber-400 font-bold">{patient.patient_mrn}</span>
                <span>&bull;</span>
                <span>{patient.full_phone}</span>
                {patient.cnic && (
                  <>
                    <span>&bull;</span>
                    <span className="font-mono">CNIC: {patient.cnic}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visit History Timeline */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
            Clinical Visit History ({history.length} Visits)
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading visit history...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No previous visits recorded.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((b) => (
                <div key={b.id} className="py-3 flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{b.booking_date}</span>
                      <span className="font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {b.token_code}
                      </span>
                      <span className="text-slate-400 font-normal">({b.slot_time_formatted})</span>
                    </div>
                    <div className="text-slate-600 mt-1">
                      Doctor: <strong>{b.doctor_name || 'Dr Naeem Khattak'}</strong> &bull; Purpose: {b.purpose}
                    </div>
                    {b.remarks && (
                      <div className="text-slate-400 text-[11px] mt-0.5">Note: {b.remarks}</div>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      b.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.status === 'checked_in'
                        ? 'bg-blue-100 text-blue-800'
                        : b.status === 'absent'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
