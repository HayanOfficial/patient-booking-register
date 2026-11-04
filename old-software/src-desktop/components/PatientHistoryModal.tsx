import React, { useState, useEffect } from 'react';
import { X, History, Calendar, Clock, User, Phone, MapPin } from 'lucide-react';
import { Booking, Patient } from '../types';
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (patient) {
      setIsLoading(true);
      api.getPatientHistory(patient.id).then((data) => {
        setHistory(data);
        setIsLoading(false);
      });
    }
  }, [patient]);

  if (!isOpen || !patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Patient Visit History</h3>
              <p className="text-[11px] text-slate-400">
                {patient.first_name} {patient.last_name || ''} ({patient.patient_mrn}) • {patient.full_phone}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto text-xs">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading visit history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No previous visits recorded.</div>
          ) : (
            <div className="divide-y divide-slate-100 space-y-3">
              {history.map((h) => (
                <div key={h.id} className="pt-3 first:pt-0 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono text-sm">{h.booking_date}</span>
                      <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                        {h.slot_time_formatted}
                      </span>
                      <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[10px] font-mono">
                        {h.token_code}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-1">
                      Doctor: <span className="font-semibold">{h.doctor_name || 'Dr Zarin'}</span> • Purpose: <span className="font-semibold">{h.purpose}</span>
                    </div>
                    {h.remarks && <div className="text-slate-400 italic mt-0.5">"{h.remarks}"</div>}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      h.status === 'completed' || h.status === 'checked_in'
                        ? 'bg-emerald-100 text-emerald-800'
                        : h.status === 'absent'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {h.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-white font-bold text-xs rounded-xl">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
