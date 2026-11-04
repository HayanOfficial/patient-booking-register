import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  Search,
  Check,
  Building,
  Layers,
  Phone,
  AlertCircle,
} from 'lucide-react';
import {
  SlotItem,
  Booking,
  Doctor,
  Shift,
  LookupItem,
  ReservationType,
  Patient,
  WaitingListItem,
} from '../types';
import { api } from '../services/api';
import { validateCnic, validatePhone } from '../utils/validators';

interface QuickBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: SlotItem | null;
  currentDate: string;
  doctor: Doctor | null;
  shift: Shift | null;
  clinicName: string;
  editingBooking?: Booking | null;
  waitingItem?: WaitingListItem | null;
  onBookingConfirmed: (newBooking: Booking) => void;
}

const PAKISTAN_PREFIXES = [
  '300', '301', '302', '303', '304', '305', '306', '307', '308', '309',
  '310', '311', '312', '313', '314', '315', '316', '317', '318',
  '320', '321', '322', '323', '324', '325',
  '330', '331', '332', '333', '334', '335', '336', '337',
  '340', '341', '342', '343', '344', '345', '346', '347', '348', '349',
];

export const QuickBookModal: React.FC<QuickBookModalProps> = ({
  isOpen,
  onClose,
  slot,
  currentDate,
  doctor,
  shift,
  clinicName,
  editingBooking,
  waitingItem,
  onBookingConfirmed,
}) => {
  if (!isOpen || (!slot && !editingBooking)) return null;

  // Form states
  const [tab, setTab] = useState<'search' | 'manual'>('manual');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  // Dropdown options
  const [sources, setSources] = useState<LookupItem[]>([]);
  const [purposes, setPurposes] = useState<LookupItem[]>([]);
  const [calledAsList, setCalledAsList] = useState<LookupItem[]>([]);
  const [cities, setCities] = useState<LookupItem[]>([]);
  const [areas, setAreas] = useState<LookupItem[]>([]);

  // Field values
  const [purpose, setPurpose] = useState<string>('Consultation');
  const [reservationType, setReservationType] = useState<ReservationType>('Appointment');
  const [source, setSource] = useState<string>('Self');
  const [calledAs, setCalledAs] = useState<string>('Hospital Patient');

  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [cnic, setCnic] = useState<string>('');
  const [phoneCode, setPhoneCode] = useState<string>('+92');
  const [phonePrefix, setPhonePrefix] = useState<string>('300');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [city, setCity] = useState<string>('Peshawar');
  const [area, setArea] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load lookup lists
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [srcs, purps, called, cits] = await Promise.all([
          api.getLookups('source', true),
          api.getLookups('purpose', true),
          api.getLookups('called_as', true),
          api.getLookups('city', true),
        ]);
        setSources(srcs);
        setPurposes(purps);
        setCalledAsList(called);
        setCities(cits);

        if (srcs.length > 0 && !editingBooking) setSource(srcs[0].name);
        if (purps.length > 0 && !editingBooking) setPurpose(purps[0].name);
        if (called.length > 0 && !editingBooking) setCalledAs(called[0].name);
        if (cits.length > 0 && !editingBooking) setCity(cits[0].name);
      } catch (err) {
        console.error('Failed to load lookups:', err);
      }
    };
    loadLookups();
  }, []);

  // Update areas whenever city changes
  useEffect(() => {
    const selectedCityObj = cities.find((c) => c.name === city);
    if (selectedCityObj) {
      api.getAreas(selectedCityObj.id, true).then((res) => {
        setAreas(res);
      });
    } else {
      setAreas([]);
    }
  }, [city, cities]);

  // Handle prefilling if editing or assigning from waiting list
  useEffect(() => {
    if (editingBooking) {
      const p = editingBooking.patient;
      setPurpose(editingBooking.purpose || 'Consultation');
      setReservationType(editingBooking.reservation_type || 'Appointment');
      setSource(editingBooking.source || 'Self');
      setCalledAs(editingBooking.called_as || 'Hospital Patient');
      setRemarks(editingBooking.remarks || '');

      if (p) {
        setFirstName(p.first_name || '');
        setLastName(p.last_name || '');
        setCnic(p.cnic || '');
        setPhoneCode(p.phone_code || '+92');
        setPhonePrefix(p.phone_prefix || '300');
        setPhoneNumber(p.phone_number || '');
        setCity(p.city || 'Peshawar');
        setArea(p.area || '');
        setAddress(p.address || '');
        setAge(p.age ? String(p.age) : '');
      }
    } else if (waitingItem) {
      setPurpose(waitingItem.purpose || 'Consultation');
      setReservationType('Walk-in');
      setSource(waitingItem.source || 'Self');
      setRemarks(waitingItem.notes || 'Assigned from Waiting Queue');

      // Parse patient name and phone
      const nameParts = (waitingItem.patient_name || '').trim().split(' ');
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');

      // Parse phone
      const rawPhone = (waitingItem.phone || '').replace(/\D/g, '');
      if (rawPhone.length >= 7) {
        setPhoneNumber(rawPhone.slice(-7));
        const pref = rawPhone.slice(-10, -7);
        if (PAKISTAN_PREFIXES.includes(pref)) {
          setPhonePrefix(pref);
        }
      } else {
        setPhoneNumber(rawPhone);
      }
    }
  }, [editingBooking, waitingItem]);

  // Search patients
  const handleSearchPatient = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      const results = await api.searchPatients(q);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatientId(p.id);
    setFirstName(p.first_name || '');
    setLastName(p.last_name || '');
    setCnic(p.cnic || '');
    setPhoneCode(p.phone_code || '+92');
    setPhonePrefix(p.phone_prefix || '300');
    setPhoneNumber(p.phone_number || '');
    setCity(p.city || 'Peshawar');
    setArea(p.area || '');
    setAddress(p.address || '');
    setAge(p.age ? String(p.age) : '');
    setTab('manual');
  };

  const handleConfirm = async () => {
    setErrorMsg('');
    if (!firstName.trim()) {
      setErrorMsg('Patient name / First name is required.');
      return;
    }

    if (phoneNumber.trim()) {
      const phoneValidation = validatePhone(phoneNumber);
      if (!phoneValidation.isValid) {
        setErrorMsg(phoneValidation.error || 'Invalid phone number.');
        return;
      }
    }

    if (cnic.trim()) {
      const cnicValidation = validateCnic(cnic);
      if (!cnicValidation.isValid) {
        setErrorMsg(cnicValidation.error || 'Invalid CNIC.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingBooking) {
        // Edit existing
        const res = await api.updateBooking({
          bookingId: editingBooking.id,
          updates: {
            purpose,
            reservation_type: reservationType,
            source,
            called_as: calledAs,
            remarks,
            first_name: firstName.trim(),
            last_name: lastName.trim() || undefined,
            phone_number: phoneNumber.trim(),
            city,
            area,
            address,
            age: age ? parseInt(age, 10) : undefined,
          },
          actorUser: { id: 'current', username: 'user', role: 'admin' },
        });

        if (res.success && res.booking) {
          onBookingConfirmed(res.booking);
          onClose();
        } else {
          setErrorMsg(res.message || 'Failed to update booking.');
        }
      } else if (slot && doctor && shift) {
        // Create new Quick Booking
        const res = await api.quickBook({
          payload: {
            booking_date: currentDate,
            doctor_id: doctor.id,
            shift_id: shift.id,
            slot_index: slot.slot_index,
            slot_time: slot.slot_time,
            slot_time_formatted: slot.slot_time_formatted,
            purpose,
            reservation_type: reservationType,
            source,
            called_as: calledAs,
            first_name: firstName.trim(),
            last_name: lastName.trim() || undefined,
            cnic: cnic.trim() || undefined,
            phone_code: phoneCode,
            phone_prefix: phonePrefix,
            phone_number: phoneNumber.trim(),
            city,
            area,
            address,
            age: age ? parseInt(age, 10) : undefined,
            remarks,
            patient_id: selectedPatientId || undefined,
            waiting_list_id: waitingItem?.id || undefined,
          },
          actorUser: { id: 'current', username: 'user', role: 'admin' },
        });

        if (res.success && res.booking) {
          onBookingConfirmed(res.booking);
          onClose();
        } else {
          setErrorMsg(res.message || 'Double booking or server error.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayTime = editingBooking ? editingBooking.slot_time_formatted : slot?.slot_time_formatted || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Amber Header */}
        <div className="bg-[#F59E0B] px-6 py-4 text-slate-950 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 text-slate-900 hover:text-white hover:bg-amber-600/60 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            <span>QUICK BOOK</span>
          </div>

          <div className="text-3xl font-black font-mono tracking-tight mt-1">
            {displayTime}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className="bg-slate-950 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <User className="w-3 h-3" />
              <span>{doctor?.name || 'Doctor'}</span>
            </div>

            <div className="bg-white text-slate-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <Layers className="w-3 h-3 text-amber-600" />
              <span>{shift?.name || 'Default Shift'}</span>
            </div>

            <div className="bg-white text-slate-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <Building className="w-3 h-3 text-amber-600" />
              <span>{clinicName}</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4 text-xs font-semibold text-slate-700">
          {/* Top Toggle: Search Patient vs Manual / Unknown */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTab('search')}
              className={`py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition text-xs ${
                tab === 'search'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search Patient</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('manual')}
              className={`py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-bold transition text-xs ${
                tab === 'manual'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Manual / Unknown</span>
            </button>
          </div>

          {/* If Search Tab Active */}
          {tab === 'search' && (
            <div className="space-y-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search existing patients by name, phone, or CNIC..."
                  value={searchQuery}
                  onChange={(e) => handleSearchPatient(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 shadow-inner">
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className="p-2 hover:bg-amber-100/70 cursor-pointer flex items-center justify-between transition"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {p.first_name} {p.last_name || ''} ({p.patient_mrn})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {p.full_phone} {p.city ? `• ${p.city}` : ''}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Select
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Purpose, Reservation Type, Source, Called As */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-slate-600">
                Purpose of Visit <span className="text-rose-500">*</span>
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs cursor-pointer font-medium"
              >
                {purposes.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600">
                Reservation Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={reservationType}
                onChange={(e) => setReservationType(e.target.value as ReservationType)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs cursor-pointer font-medium"
              >
                <option value="Appointment">Appointment</option>
                <option value="Walk-in">Walk-in</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600">
                Source of appointment <span className="text-rose-500">*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs cursor-pointer font-medium"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600">
                Called as <span className="text-rose-500">*</span>
              </label>
              <select
                value={calledAs}
                onChange={(e) => setCalledAs(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs cursor-pointer font-medium"
              >
                {calledAsList.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: First name, Last name, CNIC */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-slate-600">
                First name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-medium"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600">Last name</label>
              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-medium"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600">
                CNIC <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                maxLength={15}
                placeholder="13 digit CNIC e.g. 38403848654..."
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 3: Phone (Country + Prefix + 7 digits) */}
          <div>
            <label className="block mb-1 font-semibold text-slate-600">
              Phone <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              {/* Country Code */}
              <select
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
                className="w-36 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-medium cursor-pointer"
              >
                <option value="+92">Pakistan (+92)</option>
                <option value="+1">USA (+1)</option>
                <option value="+44">UK (+44)</option>
                <option value="+971">UAE (+971)</option>
              </select>

              {/* Prefix */}
              <select
                value={phonePrefix}
                onChange={(e) => setPhonePrefix(e.target.value)}
                className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-mono font-bold cursor-pointer"
              >
                {PAKISTAN_PREFIXES.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>

              {/* 7 Digits Input */}
              <div className="flex-1">
                <input
                  type="text"
                  maxLength={7}
                  placeholder="1234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">7 digits</span>
              </div>
            </div>
          </div>

          {/* Row 4: City and Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-semibold text-slate-600">City</label>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setArea('');
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-medium cursor-pointer"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600">Area</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-medium cursor-pointer"
              >
                <option value="">— Select Area —</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Address and Age */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block mb-1 font-semibold text-slate-600">Address</label>
              <input
                type="text"
                placeholder="House / Street"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-medium"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-600">Age</label>
              <input
                type="number"
                placeholder="e.g. 35"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-medium"
              />
            </div>
          </div>

          {/* Row 6: Remarks */}
          <div>
            <label className="block mb-1 font-semibold text-slate-600">Remarks</label>
            <textarea
              rows={2}
              placeholder="Any notes or remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs font-medium resize-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs shadow-xs transition"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-6 py-2 rounded-xl bg-[#F59E0B] hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 transition active:scale-98 disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Confirm Booking</span>
          </button>
        </div>
      </div>
    </div>
  );
};
