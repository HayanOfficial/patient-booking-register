'use client';

import React, { useState, useEffect } from 'react';
import { Hourglass, Plus, Phone, Calendar, ArrowRight, UserPlus, CheckCircle } from 'lucide-react';
import { WaitingListItem, Doctor, Shift } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface WaitingListTabProps {
  currentDate: string;
  selectedDoctorId: string;
  selectedShiftId: string;
  doctors: Doctor[];
  shifts: Shift[];
  onConvertSlot: (item: WaitingListItem) => void;
}

export const WaitingListTab: React.FC<WaitingListTabProps> = ({
  currentDate,
  selectedDoctorId,
  selectedShiftId,
  doctors,
  shifts,
  onConvertSlot,
}) => {
  const { user } = useAuth();
  const [waitingList, setWaitingList] = useState<WaitingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('Consultation');
  const [source, setSource] = useState('Phone call');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState(1);

  const loadWaitingList = async () => {
    setIsLoading(true);
    try {
      const data = await api.getWaitingList(currentDate, selectedDoctorId, selectedShiftId);
      setWaitingList(data);
    } catch (err) {
      console.error('Failed to load waiting list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWaitingList();
  }, [currentDate, selectedDoctorId, selectedShiftId]);

  const handleAddWaiting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !phone.trim()) return;

    try {
      await api.addWaitingListItem({
        booking_date: currentDate,
        doctor_id: selectedDoctorId,
        shift_id: selectedShiftId,
        patient_name: patientName.trim(),
        phone: phone.trim(),
        purpose,
        source,
        called_as: 'Hospital Patient',
        priority,
        notes: notes.trim(),
        created_by: user?.id,
      });

      setPatientName('');
      setPhone('');
      setNotes('');
      setIsAddOpen(false);
      loadWaitingList();
    } catch (err) {
      console.error('Failed to add waiting item:', err);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-amber-500" />
            <span>Shift Waiting List & Standby Queue</span>
          </h2>
          <p className="text-xs text-slate-500">
            Standby patient queue ready to be converted into newly released or cancelled intervals.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Standby Patient</span>
        </button>
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-amber-500 p-4 text-slate-950 flex items-center justify-between font-bold text-sm">
              <span>Add to Waiting List</span>
              <button onClick={() => setIsAddOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddWaiting} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Patient Name *</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Phone *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+923001234567"
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purpose</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  >
                    <option value="Phone call">Phone call</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="WhatsApp">WhatsApp</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Request</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-xl resize-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 font-bold text-slate-950 rounded-xl"
                >
                  Add Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading waiting queue...</div>
        ) : waitingList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No standby patients on the waiting list for this date and shift.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {waitingList.map((item, idx) => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black flex items-center justify-center text-xs">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{item.patient_name}</div>
                    <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{item.phone}</span>
                      </span>
                      <span>&bull;</span>
                      <span>{item.purpose}</span>
                      <span>&bull;</span>
                      <span className="text-slate-400">{item.notes || 'No notes'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onConvertSlot(item)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all"
                >
                  <span>Book Slot</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
