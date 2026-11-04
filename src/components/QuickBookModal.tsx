'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Building2,
  Layers,
  User,
  Search,
  Check,
  Phone,
  AlertCircle,
} from 'lucide-react';
import {
  SlotItem,
  Doctor,
  Shift,
  ClinicSettings,
  LookupItem,
  Booking,
  ReservationType,
} from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface QuickBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: SlotItem | null;
  doctor: Doctor | null;
  shift: Shift | null;
  clinicInfo: ClinicSettings | null;
  bookingDate: string;
  onBookingSuccess: (booking: Booking) => void;
  editingBooking?: Booking | null;
}

export const QuickBookModal: React.FC<QuickBookModalProps> = ({
  isOpen,
  onClose,
  slot,
  doctor,
  shift,
  clinicInfo,
  bookingDate,
  onBookingSuccess,
  editingBooking,
}) => {
  const { user, role } = useAuth();
  const isOperator = role === 'operator';

  // Toggle mode: 'search' vs 'manual'
  const [mode, setMode] = useState<'search' | 'manual'>('manual');

  // Form Fields
  const [purpose, setPurpose] = useState('Consultation');
  const [reservationType, setReservationType] = useState<ReservationType>('Appointment');
  const [source, setSource] = useState('TikTok');
  const [calledAs, setCalledAs] = useState('Hospital Patient');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cnic, setCnic] = useState('');
  const [phoneCode, setPhoneCode] = useState('+92');
  const [phonePrefix, setPhonePrefix] = useState('300');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('Peshawar');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [age, setAge] = useState('');
  const [remarks, setRemarks] = useState('');

  // Search Mode States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Lookups data
  const [sourcesList, setSourcesList] = useState<LookupItem[]>([]);
  const [purposesList, setPurposesList] = useState<LookupItem[]>([]);
  const [calledAsList, setCalledAsList] = useState<LookupItem[]>([]);
  const [citiesList, setCitiesList] = useState<LookupItem[]>([]);
  const [areasList, setAreasList] = useState<LookupItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generate mobile prefixes: 300 to 349
  const networkPrefixes = Array.from({ length: 50 }, (_, i) => String(300 + i));

  // Load lookup options
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      api.getLookupsByCategory('source'),
      api.getLookupsByCategory('purpose'),
      api.getLookupsByCategory('called_as'),
      api.getLookupsByCategory('city'),
      api.getLookupsByCategory('area'),
    ]).then(([srcs, purps, cas, cts, ars]) => {
      setSourcesList(srcs);
      setPurposesList(purps);
      setCalledAsList(cas);
      setCitiesList(cts);
      setAreasList(ars);
    });
  }, [isOpen]);

  // If editing an existing booking
  useEffect(() => {
    if (editingBooking) {
      setPurpose(editingBooking.purpose || 'Consultation');
      setReservationType(editingBooking.reservation_type || 'Appointment');
      setSource(editingBooking.source || 'Self');
      setCalledAs(editingBooking.called_as || 'Hospital Patient');
      setRemarks(editingBooking.remarks || '');

      const p = editingBooking.patient;
      if (p) {
        setFirstName(p.first_name || '');
        setLastName(p.last_name || '');
        setCnic(p.cnic || '');
        setPhonePrefix(p.phone_prefix || '300');
        setPhoneNumber(p.phone_number || '');
        setCity(p.city || 'Peshawar');
        setArea(p.area || '');
        setAddress(p.address || '');
        setAge(p.age ? String(p.age) : '');
        setSelectedPatientId(p.id);
      }
    } else {
      // Reset form
      setFirstName('');
      setLastName('');
      setCnic('');
      setPhoneNumber('');
      setAddress('');
      setAge('');
      setRemarks('');
      setErrorMsg(null);
      setSelectedPatientId(null);
      if (isOperator) {
        setReservationType('Appointment'); // Operators can only create Appointments
      }
    }
  }, [editingBooking, isOpen, isOperator]);

  // Live Patient Search
  useEffect(() => {
    if (mode !== 'search' || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.searchPatients(searchQuery).then(setSearchResults);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, mode]);

  const handleSelectPatient = (patient: any) => {
    setSelectedPatientId(patient.id);
    setFirstName(patient.first_name);
    setLastName(patient.last_name || '');
    setCnic(patient.cnic || '');
    setPhonePrefix(patient.phone_prefix || '300');
    setPhoneNumber(patient.phone_number || '');
    setCity(patient.city || 'Peshawar');
    setArea(patient.area || '');
    setAddress(patient.address || '');
    setAge(patient.age ? String(patient.age) : '');
    setMode('manual');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim()) {
      setErrorMsg('First name is required');
      return;
    }

    if (cnic && cnic.replace(/\D/g, '').length !== 13) {
      setErrorMsg('CNIC must be exactly 13 digits without dashes (e.g. 38403848654)');
      return;
    }

    if (phoneNumber && phoneNumber.replace(/\D/g, '').length !== 7) {
      setErrorMsg('Mobile number must be exactly 7 digits following the 3-digit network prefix');
      return;
    }

    if (!doctor || !shift) {
      setErrorMsg('Doctor and Shift must be selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const cleanCnic = cnic ? cnic.replace(/\D/g, '') : undefined;

      const createdBooking = await api.createBookingAtomic({
        doctor_id: doctor.id,
        shift_id: shift.id,
        booking_date: bookingDate,
        slot_index: slot?.slot_index || 0,
        slot_time: slot?.slot_time || '08:00',
        slot_time_formatted: slot?.slot_time_formatted || '8:00 a.m.',
        reservation_type: reservationType,
        purpose,
        source,
        called_as: calledAs,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        cnic: cleanCnic,
        phone_code: phoneCode,
        phone_prefix: phonePrefix,
        phone_number: cleanPhone,
        city: city || undefined,
        area: area || undefined,
        address: address.trim() || undefined,
        age: age ? parseInt(age, 10) : undefined,
        remarks: remarks.trim() || undefined,
        created_by: user?.id,
        username: user?.full_name || user?.username || 'user',
        existing_patient_id: selectedPatientId || undefined,
      });

      onBookingSuccess(createdBooking);
      onClose();
    } catch (err: any) {
      console.error('Booking failed:', err);
      setErrorMsg(err.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ================================================================== */}
        {/* TOP HEADER: Vibrant Yellow #F59E0B per reference Booking page.png  */}
        {/* ================================================================== */}
        <div className="bg-[#F59E0B] p-5 text-slate-950 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wider uppercase text-slate-900">
              <Calendar className="w-4 h-4 text-slate-950" />
              <span>QUICK BOOK</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-black/10 transition-colors text-slate-950"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Large Slot Time */}
          <div className="text-3xl font-black text-slate-950 tracking-tight mt-1 mb-2">
            {slot?.slot_time_formatted || '5:18 p.m.'}
          </div>

          {/* Header Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 px-3 py-1 bg-black text-white text-[11px] font-bold rounded-md">
              <User className="w-3.5 h-3.5" />
              <span>{doctor?.name || 'Dr Naeem Khattak'}</span>
            </div>

            <div className="flex items-center gap-1 px-3 py-1 bg-white text-slate-900 text-[11px] font-bold rounded-md shadow-xs">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>{shift?.name || 'Default Shift'}</span>
            </div>

            <div className="flex items-center gap-1 px-3 py-1 bg-white text-slate-900 text-[11px] font-bold rounded-md shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              <span>{clinicInfo?.name || 'Dr Naeem Eye Laser & Retina Center'}</span>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* SEARCH / MANUAL TOGGLE                                              */}
        {/* ================================================================== */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-xs ${
                mode === 'search'
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search Patient</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-xs ${
                mode === 'manual'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Manual / Unknown</span>
            </button>
          </div>

          {/* Search Patient Box */}
          {mode === 'search' && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by patient name, phone, CNIC, or MRN..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  autoFocus
                />
              </div>

              {searchResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl bg-white max-h-48 overflow-y-auto divide-y divide-slate-100 shadow-lg">
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className="p-2.5 hover:bg-amber-50 cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {p.first_name} {p.last_name || ''}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {p.full_phone} &bull; {p.cnic || 'No CNIC'} &bull; {p.patient_mrn}
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                        Select
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================== */}
        {/* BOOKING FORM (Row layout exactly matches reference Booking page.png)*/}
        {/* ================================================================== */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Purpose, Reservation Type, Source, Called As */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Purpose of Visit <span className="text-rose-500">*</span>
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                {purposesList.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Reservation Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={reservationType}
                onChange={(e) => setReservationType(e.target.value as ReservationType)}
                disabled={isOperator} // Operator can only book Appointments
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:bg-slate-100"
              >
                <option value="Appointment">Appointment</option>
                {!isOperator && <option value="Walk-in">Walk-in</option>}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Source of appointment <span className="text-rose-500">*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                {sourcesList.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Called as <span className="text-rose-500">*</span>
              </label>
              <select
                value={calledAs}
                onChange={(e) => setCalledAs(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                {calledAsList.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: First Name, Last Name, CNIC */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                First name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">CNIC (optional)</label>
              <input
                type="text"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                placeholder="13 digit CNIC e.g. 38403848654"
                maxLength={13}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 3: Phone (Country + Prefix + 7 digits) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone</label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5">
                <select
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="+92">Pakistan (+92)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <select
                  value={phonePrefix}
                  onChange={(e) => setPhonePrefix(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  {networkPrefixes.map((prefix) => (
                    <option key={prefix} value={prefix}>
                      {prefix}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="1234567"
                  maxLength={7}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">7 digits</span>
              </div>
            </div>
          </div>

          {/* Row 4: City, Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                {citiesList.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Area</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                <option value="">— Select Area —</option>
                {areasList.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Address, Age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House / Street"
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 35"
                min={0}
                max={120}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 6: Remarks */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any notes or remarks..."
              rows={2}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* ================================================================== */}
          {/* MODAL FOOTER: Cancel (Slate) and Confirm Booking (Golden #F59E0B) */}
          {/* ================================================================== */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs transition-colors shadow-xs"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-xl bg-[#F59E0B] hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Confirming...' : 'Confirm Booking'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
