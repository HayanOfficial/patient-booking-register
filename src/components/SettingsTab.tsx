'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Stethoscope,
  Clock,
  Tag,
  Building,
  Plus,
  Edit2,
  Check,
  Save,
  MapPin,
} from 'lucide-react';
import { Doctor, Shift, LookupItem, ClinicSettings } from '../types';
import { api } from '../services/api';

export const SettingsTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'clinic' | 'doctors' | 'shifts' | 'lookups'>('clinic');

  // Clinic Info
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>({
    name: '',
    tagline: '',
    phone: '',
    address: '',
    website: '',
    emergency_phone: '',
  });

  // Doctors & Shifts
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  // Lookups
  const [allLookups, setAllLookups] = useState<LookupItem[]>([]);
  const [selectedLookupCategory, setSelectedLookupCategory] = useState<'source' | 'purpose' | 'called_as' | 'city' | 'area'>('source');

  // Add / Edit Modal State
  const [newItemName, setNewItemName] = useState('');
  const [newItemColor, setNewItemColor] = useState('#3B82F6');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [c, docs, lookups] = await Promise.all([
        api.getClinicInfo(),
        api.getAllDoctors(),
        api.getAllLookups(),
      ]);
      setClinicSettings(c);
      setDoctors(docs);
      setAllLookups(lookups);

      if (docs[0]?.id) {
        const s = await api.getShifts(docs[0].id);
        setShifts(s);
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveClinicInfo(clinicSettings);
      setFeedbackMsg('Clinic profile saved successfully');
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      await api.saveLookupItem({
        category: selectedLookupCategory,
        name: newItemName.trim(),
        color: newItemColor,
      });
      setNewItemName('');
      loadData();
      setFeedbackMsg(`Added new ${selectedLookupCategory} option`);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <span>Clinic Configuration & Master Settings</span>
          </h2>
          <p className="text-xs text-slate-500">
            Doctors, shifts, slot interval duration, acquisition sources, and hospital branding.
          </p>
        </div>

        {feedbackMsg && (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold animate-in fade-in">
            {feedbackMsg}
          </span>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSection('clinic')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'clinic'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Clinic Profile</span>
        </button>

        <button
          onClick={() => setActiveSection('doctors')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'doctors'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>Doctors & Specialists</span>
        </button>

        <button
          onClick={() => setActiveSection('shifts')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'shifts'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Shifts & Slot Duration</span>
        </button>

        <button
          onClick={() => setActiveSection('lookups')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSection === 'lookups'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Lookup Categories & Sources</span>
        </button>
      </div>

      {/* SECTION 1: Clinic Profile */}
      {activeSection === 'clinic' && (
        <form onSubmit={handleSaveClinic} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Clinic Name</label>
              <input
                type="text"
                value={clinicSettings.name}
                onChange={(e) => setClinicSettings({ ...clinicSettings, name: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tagline / Subtitle</label>
              <input
                type="text"
                value={clinicSettings.tagline}
                onChange={(e) => setClinicSettings({ ...clinicSettings, tagline: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Front Desk Contact</label>
              <input
                type="text"
                value={clinicSettings.phone}
                onChange={(e) => setClinicSettings({ ...clinicSettings, phone: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Physical Address</label>
              <input
                type="text"
                value={clinicSettings.address}
                onChange={(e) => setClinicSettings({ ...clinicSettings, address: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Clinic Profile</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION 2: Doctors */}
      {activeSection === 'doctors' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Registered Medical Doctors</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {doctors.map((d) => (
              <div key={d.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{d.name}</div>
                  <div className="text-slate-500">{d.specialty} &bull; {d.phone}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: Shifts & Slot Duration */}
      {activeSection === 'shifts' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Shift Timings & Slot Duration</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {shifts.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{s.name}</div>
                  <div className="text-slate-500">
                    Timings: {s.start_time} - {s.end_time} &bull; Slot Interval: <strong>{s.slot_duration_minutes} minutes</strong>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px]">
                  94 Slots Configured
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: Lookups */}
      {activeSection === 'lookups' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2">
            {(['source', 'purpose', 'called_as', 'city', 'area'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedLookupCategory(cat)}
                className={`px-3 py-1.5 rounded-xl capitalize font-bold ${
                  selectedLookupCategory === cat
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-slate-50 text-slate-600 border border-slate-200'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          <form onSubmit={handleAddLookup} className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Add new ${selectedLookupCategory} option...`}
              className="flex-1 p-2 border border-slate-300 rounded-xl"
            />
            {selectedLookupCategory === 'source' && (
              <input
                type="color"
                value={newItemColor}
                onChange={(e) => setNewItemColor(e.target.value)}
                className="w-10 h-9 p-0.5 border border-slate-300 rounded-xl cursor-pointer"
                title="Badge Color"
              />
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl"
            >
              Add Option
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {allLookups
              .filter((l) => l.category === selectedLookupCategory)
              .map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2"
                >
                  {item.color && (
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  )}
                  <span className="font-bold text-slate-800">{item.name}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
