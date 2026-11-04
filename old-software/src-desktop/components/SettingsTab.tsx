import React, { useState, useEffect } from 'react';
import {
  Settings,
  Tag,
  Target,
  UserCheck,
  MapPin,
  Clock,
  Building,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { LookupCategory, LookupItem, Doctor, Shift, ClinicSettings } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SettingsTabProps {
  onSettingsChanged?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ onSettingsChanged }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'lookups' | 'doctors' | 'clinic'>('lookups');
  const [lookupCategory, setLookupCategory] = useState<LookupCategory>('source');

  // Lookup state
  const [lookupItems, setLookupItems] = useState<LookupItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');

  // Cities & Areas
  const [cities, setCities] = useState<LookupItem[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');

  // Doctors & Shifts state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState('');
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [editingDoctorName, setEditingDoctorName] = useState('');
  const [editingDoctorSpecialty, setEditingDoctorSpecialty] = useState('');
  const [newShiftName, setNewShiftName] = useState('Full Day Shift');
  const [newShiftDoctorId, setNewShiftDoctorId] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('22:00');
  const [newShiftDuration, setNewShiftDuration] = useState(9);

  // Clinic info state
  const [clinicInfo, setClinicInfo] = useState<ClinicSettings>({
    name: '',
    tagline: '',
    phone: '',
    address: '',
  });

  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const actorUser = { id: user?.id || 'admin', username: user?.username || 'admin', role: user?.role || 'admin' };

  const loadLookups = async () => {
    try {
      if (lookupCategory === 'area') {
        const cits = await api.getLookups('city', false);
        setCities(cits);
        const cityId = selectedCityId || (cits[0] ? cits[0].id : '');
        setSelectedCityId(cityId);
        if (cityId) {
          const areas = await api.getAreas(cityId, false);
          setLookupItems(areas);
        }
      } else {
        const items = await api.getLookups(lookupCategory, false);
        setLookupItems(items);
      }
    } catch (err) {
      console.error('Failed to load lookups:', err);
    }
  };

  const loadDoctorsAndShifts = async () => {
    try {
      const docs = await api.getDoctors();
      setDoctors(docs);
      if (docs[0] && !newShiftDoctorId) {
        setNewShiftDoctorId(docs[0].id);
      }
      if (docs[0]) {
        const shs = await api.getShifts(docs[0].id);
        setShifts(shs);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    }
  };

  const loadClinic = async () => {
    try {
      const info = await api.getClinicInfo();
      if (info) setClinicInfo(info);
    } catch (err) {
      console.error('Failed to load clinic info:', err);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'lookups') loadLookups();
    if (activeSubTab === 'doctors') loadDoctorsAndShifts();
    if (activeSubTab === 'clinic') loadClinic();
  }, [activeSubTab, lookupCategory, selectedCityId]);

  // Handle Lookup Actions
  const handleAddLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      await api.createLookup({
        item: {
          category: lookupCategory,
          name: newItemName.trim(),
          parent_id: lookupCategory === 'area' ? selectedCityId : undefined,
        },
        actorUser,
      });
      setNewItemName('');
      loadLookups();
      setMessage({ text: 'Item added successfully.' });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleUpdateLookup = async (id: string) => {
    if (!editingItemName.trim()) return;
    try {
      await api.updateLookup({
        id,
        updates: { name: editingItemName.trim() },
        actorUser,
      });
      setEditingItemId(null);
      loadLookups();
      setMessage({ text: 'Updated successfully.' });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleToggleLookupActive = async (item: LookupItem) => {
    try {
      await api.updateLookup({
        id: item.id,
        updates: { is_active: !item.is_active },
        actorUser,
      });
      loadLookups();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleDeleteLookup = async (id: string) => {
    if (window.confirm('Delete this item?')) {
      await api.deleteLookup({ id, actorUser });
      loadLookups();
    }
  };

  // Handle Doctor & Shift Actions
  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctorName.trim()) return;
    try {
      await api.createDoctor({
        doc: { name: newDoctorName.trim(), specialty: newDoctorSpecialty.trim() },
        actorUser,
      });
      setNewDoctorName('');
      setNewDoctorSpecialty('');
      loadDoctorsAndShifts();
      setMessage({ text: 'Doctor added successfully.' });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleDeleteDoctor = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This will remove them from the active register.`)) {
      try {
        await api.deleteDoctor({ id, actorUser });
        loadDoctorsAndShifts();
        setMessage({ text: `${name} has been deleted.` });
      } catch (err: any) {
        setMessage({ text: err.message, isError: true });
      }
    }
  };

  const handleToggleDoctorActive = async (doc: Doctor) => {
    try {
      await api.updateDoctor({
        id: doc.id,
        updates: { is_active: doc.is_active ? 0 : 1 },
        actorUser,
      });
      loadDoctorsAndShifts();
      setMessage({ text: `${doc.name} status updated.` });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleUpdateDoctor = async (id: string) => {
    if (!editingDoctorName.trim()) return;
    try {
      await api.updateDoctor({
        id,
        updates: {
          name: editingDoctorName.trim(),
          specialty: editingDoctorSpecialty.trim(),
        },
        actorUser,
      });
      setEditingDoctorId(null);
      loadDoctorsAndShifts();
      setMessage({ text: 'Doctor details updated successfully.' });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftDoctorId || !newShiftName.trim()) return;
    try {
      await api.createShift({
        shift: {
          doctor_id: newShiftDoctorId,
          name: newShiftName.trim(),
          start_time: newShiftStart,
          end_time: newShiftEnd,
          slot_duration_minutes: Number(newShiftDuration),
        },
        actorUser,
      });
      setNewShiftName('');
      loadDoctorsAndShifts();
      onSettingsChanged?.();
      setMessage({ text: 'Shift schedule added successfully.' });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleDeleteShift = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete shift "${name}"?`)) {
      try {
        await api.deleteShift({ id, actorUser });
        loadDoctorsAndShifts();
        onSettingsChanged?.();
        setMessage({ text: `Shift "${name}" deleted.` });
      } catch (err: any) {
        setMessage({ text: err.message, isError: true });
      }
    }
  };

  const handleToggleShiftActive = async (s: Shift) => {
    try {
      await api.updateShift({
        id: s.id,
        updates: { is_active: s.is_active ? 0 : 1 },
        actorUser,
      });
      loadDoctorsAndShifts();
      onSettingsChanged?.();
      setMessage({ text: `Shift status updated.` });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateClinicInfo({ info: clinicInfo, actorUser });
      onSettingsChanged?.();
      setMessage({ text: 'Clinic settings saved.' });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" />
          <span>System Settings & Configuration</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure sources, purposes, patient categories, cities/areas, doctors, shifts, and clinic details.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
            message.isError
              ? 'bg-rose-50 border border-rose-200 text-rose-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          }`}
        >
          {message.isError ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('lookups')}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition ${
            activeSubTab === 'lookups'
              ? 'border-amber-500 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Dropdown Lists & Categories
        </button>

        <button
          onClick={() => setActiveSubTab('doctors')}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition ${
            activeSubTab === 'doctors'
              ? 'border-amber-500 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Doctors & Shift Schedules
        </button>

        <button
          onClick={() => setActiveSubTab('clinic')}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition ${
            activeSubTab === 'clinic'
              ? 'border-amber-500 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Clinic Information
        </button>
      </div>

      {/* TAB 1: LOOKUPS */}
      {activeSubTab === 'lookups' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { cat: 'source' as LookupCategory, label: 'Sources (Self, FB, TikTok...)', icon: Tag },
                { cat: 'purpose' as LookupCategory, label: 'Purposes (Consultation...)', icon: Target },
                { cat: 'called_as' as LookupCategory, label: 'Called As (Hospital Patient...)', icon: UserCheck },
                { cat: 'city' as LookupCategory, label: 'Cities', icon: MapPin },
                { cat: 'area' as LookupCategory, label: 'Areas (Dependent on City)', icon: MapPin },
              ] as const
            ).map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.cat}
                  onClick={() => setLookupCategory(c.cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                    lookupCategory === c.cat
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          {/* If Area Category is selected: Show City selector */}
          {lookupCategory === 'area' && (
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center gap-3 text-xs">
              <span className="font-bold text-amber-900">Select City to Manage Areas:</span>
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg p-1.5 font-bold"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Add New Item Form */}
          <form onSubmit={handleAddLookup} className="flex gap-2">
            <input
              type="text"
              required
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Add new ${lookupCategory} name...`}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-5 py-2 rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </form>

          {/* List Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase text-[10px]">
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lookupItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      {editingItemId === item.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingItemName}
                            onChange={(e) => setEditingItemName(e.target.value)}
                            className="border border-amber-400 rounded px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => handleUpdateLookup(item.id)}
                            className="bg-amber-500 text-slate-950 font-bold px-2 py-1 rounded text-xs"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-900">{item.name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleLookupActive(item)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingItemId(item.id);
                            setEditingItemName(item.name);
                          }}
                          className="p-1 hover:text-amber-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteLookup(item.id)} className="p-1 hover:text-rose-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DOCTORS & SHIFTS */}
      {activeSubTab === 'doctors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Doctors Section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Doctors List</h3>
            <form onSubmit={handleAddDoctor} className="space-y-2">
              <input
                type="text"
                required
                value={newDoctorName}
                onChange={(e) => setNewDoctorName(e.target.value)}
                placeholder="Doctor Name (e.g. Dr Zarin)"
                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-semibold"
              />
              <input
                type="text"
                value={newDoctorSpecialty}
                onChange={(e) => setNewDoctorSpecialty(e.target.value)}
                placeholder="Specialty (e.g. Consultant Physician)"
                className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg shadow-xs"
              >
                Add Doctor
              </button>
            </form>

            <div className="divide-y divide-slate-100 mt-3 max-h-[380px] overflow-y-auto pr-1">
              {doctors.map((d) => (
                <div key={d.id} className="py-2.5 flex justify-between items-center gap-2">
                  {editingDoctorId === d.id ? (
                    <div className="flex-1 flex flex-col gap-1.5">
                      <input
                        type="text"
                        value={editingDoctorName}
                        onChange={(e) => setEditingDoctorName(e.target.value)}
                        placeholder="Doctor Name"
                        className="border border-slate-300 rounded-md p-1.5 text-xs font-bold"
                      />
                      <input
                        type="text"
                        value={editingDoctorSpecialty}
                        onChange={(e) => setEditingDoctorSpecialty(e.target.value)}
                        placeholder="Specialty"
                        className="border border-slate-300 rounded-md p-1.5 text-xs text-slate-600"
                      />
                      <div className="flex gap-1.5 mt-1">
                        <button
                          onClick={() => handleUpdateDoctor(d.id)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-md text-[11px]"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingDoctorId(null)}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-md text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 truncate">{d.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{d.specialty || 'General'}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleDoctorActive(d)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                            d.is_active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title={d.is_active ? 'Click to disable' : 'Click to activate'}
                        >
                          {d.is_active ? 'Active' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingDoctorId(d.id);
                            setEditingDoctorName(d.name);
                            setEditingDoctorSpecialty(d.specialty || '');
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-600 rounded-md hover:bg-amber-50 transition"
                          title="Edit Doctor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoctor(d.id, d.name)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded-md hover:bg-rose-50 transition"
                          title="Delete Doctor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Shifts Section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Shift Configuration & Slot Generation</h3>
            <form onSubmit={handleAddShift} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Doctor</label>
                <select
                  value={newShiftDoctorId}
                  onChange={(e) => setNewShiftDoctorId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Shift Name</label>
                <input
                  type="text"
                  required
                  value={newShiftName}
                  onChange={(e) => setNewShiftName(e.target.value)}
                  placeholder="e.g. Evening Shift"
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newShiftStart}
                    onChange={(e) => setNewShiftStart(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    value={newShiftEnd}
                    onChange={(e) => setNewShiftEnd(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Slot Mins</label>
                  <input
                    type="number"
                    value={newShiftDuration}
                    onChange={(e) => setNewShiftDuration(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg shadow-xs"
              >
                Add Shift Schedule
              </button>
            </form>

            {/* Existing Shifts List */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <h4 className="font-bold text-xs text-slate-700">Existing Shifts & Timings</h4>
              <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
                {shifts.map((s) => {
                  const doc = doctors.find((d) => d.id === s.doctor_id);
                  return (
                    <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {doc ? doc.name : 'All Doctors'} | {s.start_time} - {s.end_time} ({s.slot_duration_minutes} min slots)
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleShiftActive(s)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {s.is_active ? 'Active' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => handleDeleteShift(s.id, s.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete Shift"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLINIC SETTINGS */}
      {activeSubTab === 'clinic' && (
        <form onSubmit={handleSaveClinic} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-xl space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-slate-700">Clinic / Hospital Name</label>
            <input
              type="text"
              required
              value={clinicInfo.name}
              onChange={(e) => setClinicInfo({ ...clinicInfo, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Tagline / Subtitle</label>
            <input
              type="text"
              value={clinicInfo.tagline}
              onChange={(e) => setClinicInfo({ ...clinicInfo, tagline: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Contact Phone</label>
            <input
              type="text"
              value={clinicInfo.phone}
              onChange={(e) => setClinicInfo({ ...clinicInfo, phone: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Address</label>
            <input
              type="text"
              value={clinicInfo.address}
              onChange={(e) => setClinicInfo({ ...clinicInfo, address: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-6 py-2.5 rounded-xl shadow-md transition"
          >
            Save Clinic Settings
          </button>
        </form>
      )}
    </div>
  );
};
