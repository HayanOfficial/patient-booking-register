import React, { useState, useEffect } from 'react';
import { Hourglass, Plus, Trash2, ArrowRight, User, Phone, Tag, Calendar, Layers, AlertCircle } from 'lucide-react';
import { WaitingListItem, Doctor, Shift, LookupItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface WaitingListTabProps {
  currentDate: string;
  doctors: Doctor[];
  selectedDoctorId: string;
  onDoctorChange: (id: string) => void;
  shifts: Shift[];
  selectedShiftId: string;
  onShiftChange: (id: string) => void;
  onAssignToSlot: (item: WaitingListItem) => void;
}

export const WaitingListTab: React.FC<WaitingListTabProps> = ({
  currentDate,
  doctors,
  selectedDoctorId,
  onDoctorChange,
  shifts,
  selectedShiftId,
  onShiftChange,
  onAssignToSlot,
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<WaitingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('Consultation');
  const [source, setSource] = useState('Self');
  const [priority, setPriority] = useState(1);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [sources, setSources] = useState<LookupItem[]>([]);
  const [purposes, setPurposes] = useState<LookupItem[]>([]);

  const activeDocId = selectedDoctorId || (doctors[0]?.id ?? '');
  const activeShiftId = selectedShiftId || (shifts[0]?.id ?? '');

  const loadWaitingList = async () => {
    setIsLoading(true);
    try {
      const data = await api.getWaitingList({
        date: currentDate,
        doctorId: activeDocId || undefined,
        shiftId: activeShiftId || undefined,
      });
      setItems(data);
    } catch (err) {
      console.error('Failed to load waiting list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWaitingList();
    api.getLookups('source', true).then((res) => {
      setSources(res);
      if (res.length > 0) setSource(res[0].name);
    });
    api.getLookups('purpose', true).then((res) => {
      setPurposes(res);
      if (res.length > 0) setPurpose(res[0].name);
    });
  }, [currentDate, activeDocId, activeShiftId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!patientName.trim()) {
      setErrorMsg('Patient name is required.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Phone number is required.');
      return;
    }

    const docId = activeDocId || doctors[0]?.id;
    const shId = activeShiftId || shifts[0]?.id;

    if (!docId || !shId) {
      setErrorMsg('Please configure a doctor and shift first before adding to the waiting queue.');
      return;
    }

    try {
      await api.addWaitingList({
        item: {
          booking_date: currentDate,
          doctor_id: docId,
          shift_id: shId,
          patient_name: patientName.trim(),
          phone: phone.trim(),
          purpose,
          source,
          priority: Number(priority),
          notes: notes.trim(),
        },
        actorUser: { id: user?.id || 'admin', username: user?.username || 'admin', role: user?.role || 'admin' },
      });

      setPatientName('');
      setPhone('');
      setNotes('');
      setShowAddForm(false);
      loadWaitingList();
    } catch (err: any) {
      console.error('Failed to add to waiting list:', err);
      setErrorMsg(err.message || 'Failed to add waiting list item.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Remove patient from waiting list?')) {
      await api.deleteWaitingList({
        id,
        actorUser: { id: user?.id || 'admin', username: user?.username || 'admin', role: user?.role || 'admin' },
      });
      loadWaitingList();
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-amber-500" />
            <span>Standby Waiting Queue ({currentDate})</span>
          </h2>
          <p className="text-xs text-slate-500">
            Standby patient list ready for immediate assignment to open or cancelled appointment slots.
          </p>
        </div>

        {/* Doctor & Shift Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedDoctorId}
              onChange={(e) => onDoctorChange(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden font-bold text-slate-800 cursor-pointer"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedShiftId}
              onChange={(e) => onShiftChange(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden font-bold text-slate-800 cursor-pointer"
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Patient to Queue</span>
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white p-5 rounded-2xl border border-amber-400 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-500" />
              <span>New Waiting Queue Entry</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">
              Assigned to: {doctors.find(d => d.id === activeDocId)?.name || 'Dr Zarin'}
            </span>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block mb-1 font-semibold text-slate-600">Patient Name *</label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-slate-600">Phone Number *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03001234567"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono font-bold"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-slate-600">Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
              >
                {purposes.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-semibold text-slate-600">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block mb-1 font-semibold text-slate-600">Priority (1 = highest urgency)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block mb-1 font-semibold text-slate-600">Medical Notes / Standby Reason</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Urgent checkup, waiting in reception area..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs"
            >
              Save to Waiting Queue
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading waiting queue...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Hourglass className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-600 text-sm">Waiting queue is currently empty</p>
            <p className="text-xs text-slate-400 mt-1">No standby patients registered for this doctor/shift.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center font-mono">
                    #{idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{item.patient_name}</span>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200">
                        Priority {item.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1 font-mono text-emerald-700 font-semibold">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        {item.phone}
                      </span>
                      <span>• {item.purpose}</span>
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-blue-500" />
                        {item.source}
                      </span>
                      {item.notes && <span className="text-slate-500 italic">"{item.notes}"</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAssignToSlot(item)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                  >
                    <span>Assign to Open Slot</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Remove from queue"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
