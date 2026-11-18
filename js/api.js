// ==============================================================================
// Patient Booking Register - API Layer
// Supabase-first with in-memory local fallback for offline/demo use
// ==============================================================================
import { supabase, isSupabaseConfigured } from './supabase.js';
import { SlotEngine } from './slot-engine.js';
import { todayDateString, formatTime12h } from './utils.js';
import { getSession } from './auth.js';

// ---------------------------------------------------------------------------
// BroadcastChannel for cross-tab sync
// ---------------------------------------------------------------------------
export const syncChannel = typeof window !== 'undefined'
  ? new BroadcastChannel('pbr_realtime_events')
  : null;

function broadcastEvent(type, payload) {
  if (syncChannel) syncChannel.postMessage({ type, payload });
}

// ---------------------------------------------------------------------------
// Default / seed data (local fallback)
// ---------------------------------------------------------------------------
const DEFAULT_DOCTORS = [
  { id: 'd1111111-1111-1111-1111-111111111111', name: 'Dr Zarin Khan',       specialty: 'Consultant Laparoscopic & Bariatric Surgeon', phone: '+923005901111', is_active: true, sort_order: 1 },
  { id: 'd2222222-2222-2222-2222-222222222222', name: 'Dr Tariq Shah',      specialty: 'Consultant Laparoscopic & General Surgeon',   phone: '+923005902222', is_active: true, sort_order: 2 },
];

const DEFAULT_SHIFTS = [
  { id: 'e1111111-1111-1111-1111-111111111111', doctor_id: 'd1111111-1111-1111-1111-111111111111', name: 'Default Shift', start_time: '08:00', end_time: '22:00', slot_duration_minutes: 9, days_of_week: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], is_active: true, sort_order: 1 },
  { id: 'e2222222-2222-2222-2222-222222222222', doctor_id: 'd1111111-1111-1111-1111-111111111111', name: 'Morning Shift', start_time: '09:00', end_time: '14:00', slot_duration_minutes: 10, is_active: true, sort_order: 2 },
];

const DEFAULT_LOOKUPS = [
  { id: 'src-1', category: 'source',   name: 'Self',           color: '#3B82F6', is_active: true, sort_order: 1 },
  { id: 'src-2', category: 'source',   name: 'Facebook',       color: '#1877F2', is_active: true, sort_order: 2 },
  { id: 'src-3', category: 'source',   name: 'TikTok',         color: '#000000', is_active: true, sort_order: 3 },
  { id: 'src-4', category: 'source',   name: 'Instagram',      color: '#E1306C', is_active: true, sort_order: 4 },
  { id: 'src-5', category: 'source',   name: 'YouTube',        color: '#FF0000', is_active: true, sort_order: 5 },
  { id: 'src-6', category: 'source',   name: 'Website',        color: '#10B981', is_active: true, sort_order: 6 },
  { id: 'src-7', category: 'source',   name: 'WhatsApp',       color: '#25D366', is_active: true, sort_order: 7 },
  { id: 'src-8', category: 'source',   name: 'Referral',       color: '#8B5CF6', is_active: true, sort_order: 8 },
  { id: 'src-9', category: 'source',   name: 'Phone call',     color: '#EC4899', is_active: true, sort_order: 9 },
  { id: 'purp-1', category: 'purpose', name: 'Consultation',   color: '#EF4444', is_active: true, sort_order: 1 },
  { id: 'purp-2', category: 'purpose', name: 'Follow Up',      color: '#3B82F6', is_active: true, sort_order: 2 },
  { id: 'purp-3', category: 'purpose', name: 'Procedure',      color: '#10B981', is_active: true, sort_order: 3 },
  { id: 'purp-4', category: 'purpose', name: 'Emergency',      color: '#DC2626', is_active: true, sort_order: 4 },
  { id: 'purp-5', category: 'purpose', name: 'Report Review',  color: '#F59E0B', is_active: true, sort_order: 5 },
  { id: 'ca-1',  category: 'called_as', name: 'Hospital Patient', color: '#0284C7', is_active: true, sort_order: 1 },
  { id: 'ca-2',  category: 'called_as', name: 'VIP',              color: '#F59E0B', is_active: true, sort_order: 2 },
  { id: 'ca-3',  category: 'called_as', name: 'Staff Member',     color: '#10B981', is_active: true, sort_order: 3 },
  { id: 'ca-4',  category: 'called_as', name: 'Relative',         color: '#8B5CF6', is_active: true, sort_order: 4 },
  { id: 'city-pesh',  category: 'city', name: 'Peshawar',   is_active: true, sort_order: 1 },
  { id: 'city-isb',   category: 'city', name: 'Islamabad',  is_active: true, sort_order: 2 },
  { id: 'city-rwp',   category: 'city', name: 'Rawalpindi', is_active: true, sort_order: 3 },
  { id: 'city-lhr',   category: 'city', name: 'Lahore',     is_active: true, sort_order: 4 },
  { id: 'city-khi',   category: 'city', name: 'Karachi',    is_active: true, sort_order: 5 },
  { id: 'city-other', category: 'city', name: 'Other',      is_active: true, sort_order: 9 },
  { id: 'area-1', category: 'area', parent_id: 'city-pesh', name: 'Hayatabad Phase 1', is_active: true, sort_order: 1 },
  { id: 'area-2', category: 'area', parent_id: 'city-pesh', name: 'Hayatabad Phase 2', is_active: true, sort_order: 2 },
  { id: 'area-3', category: 'area', parent_id: 'city-pesh', name: 'University Town',   is_active: true, sort_order: 3 },
  { id: 'area-4', category: 'area', parent_id: 'city-pesh', name: 'Saddar',            is_active: true, sort_order: 4 },
  { id: 'area-5', category: 'area', parent_id: 'city-pesh', name: 'Kohat Road Peshawar', is_active: true, sort_order: 5 },
];

const DEFAULT_CLINIC = {
  name: 'Bariatric Surgery Clinic',
  tagline: 'Real-time schedule and patient coordination center',
  phone: '+92-91-5840000',
  address: 'Khyber Medical Centre, Peshawar',
  website: 'www.clinic.com',
  emergency_phone: '+92-300-5900000',
};

// Generate seed bookings for today and 29 days back
function generateSeedBookings() {
  const bookings = [];
  const patients = [];
  const firstNames = ['Ubaida','Balbla','Fareed Ullah','Jahanzaib','Abdur Raheem','Qazi Maria','Rasheed','Saeed Khan','Akbar Jan','Hussain','Dr Aizaz','Zulfiqar','Kamran','Bushra Bibi','Taimoor','Noman'];
  const lastNames  = ['Khan','Afridi','Ahmad','Mohmand','Jan','Shah','Bangash','Shinwari'];
  const sources    = ['Self','Facebook','TikTok','Instagram','YouTube','Website','WhatsApp','Referral','Phone call'];
  const purposes   = ['Consultation','Follow Up','Procedure','Report Review'];
  const areas      = ['Hayatabad Phase 1','Hayatabad Phase 2','University Town','Kohat Road Peshawar','Saddar'];

  const todayStr = todayDateString();
  const [ty, tm, td] = todayStr.split('-').map(Number);

  let pc = 10001;
  for (let dayOff = 0; dayOff < 30; dayOff++) {
    const d = new Date(Date.UTC(ty, tm - 1, td - dayOff));
    const dateStr = d.toISOString().split('T')[0];
    const count = dayOff === 0 ? 63 : 25 + (dayOff * 7) % 25;

    for (let si = 1; si <= count; si++) {
      pc++;
      const slotMins = 8 * 60 + (si - 1) * 9;
      const h24 = Math.floor(slotMins / 60);
      const min = slotMins % 60;
      const slotTime = `${String(h24).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
      const slotTimeFormatted = formatTime12h(slotMins);

      const resType = si % 4 === 0 ? 'Walk-in' : 'Appointment';
      const source  = sources[(si * 3 + dayOff) % sources.length];
      const purpose = purposes[(si * 2) % purposes.length];

      let status = 'pending';
      if (dayOff === 0) {
        if (si <= 27) status = 'checked_in';
        else if (si <= 30) status = 'in_process';
        else if (si % 15 === 0) status = 'absent';
        else status = 'pending';
      } else {
        if (si % 10 === 0) status = 'absent';
        else if (purpose === 'Follow Up') status = 'follow_up';
        else status = 'completed';
      }

      const pId = `p-${pc}`;
      const fn = firstNames[(si + dayOff) % firstNames.length];
      const ln = lastNames[(si * 2 + dayOff) % lastNames.length];
      const fp = `+92333${String(1000000 + si * 179 + dayOff * 231).slice(0, 7)}`;
      const cnic = `17301${String(10000000 + si * 137 + dayOff * 99).slice(0, 8)}`;
      const area = areas[(si + dayOff) % areas.length];
      const age  = 18 + ((si * 3 + dayOff) % 55);

      const patient = { id: pId, patient_mrn: `MRN-${pc}`, first_name: fn, last_name: ln, cnic, phone_code: '+92', phone_prefix: '333', phone_number: fp.slice(5), full_phone: fp, city: 'Peshawar', area, age };
      patients.push(patient);

      const tokenCode = `${resType === 'Walk-in' ? 'W' : 'A'}-${String(si).padStart(3, '0')}`;
      bookings.push({
        id: `b-${dateStr}-${si}`,
        booking_date: dateStr,
        doctor_id: 'd1111111-1111-1111-1111-111111111111',
        shift_id:  'e1111111-1111-1111-1111-111111111111',
        patient_id: pId,
        slot_index: si,
        slot_time: slotTime,
        slot_time_formatted: slotTimeFormatted,
        token_number: si,
        token_code: tokenCode,
        purpose, reservation_type: resType, source,
        called_as: 'Hospital Patient',
        status,
        check_in_time: (status === 'checked_in' || status === 'completed') ? `${dateStr}T08:28:00+05:00` : null,
        completed_time: status === 'completed' ? `${dateStr}T09:15:00+05:00` : null,
        reprinted_count: 0,
        created_at: `${dateStr}T08:00:00+05:00`,
        updated_at: `${dateStr}T08:00:00+05:00`,
        patient,
        doctor_name: 'Dr Zarin Khan',
        shift_name: 'Default Shift',
      });
    }
  }
  return { bookings, patients };
}

const _seed = generateSeedBookings();
let _doctors  = [...DEFAULT_DOCTORS];
let _shifts   = [...DEFAULT_SHIFTS];
let _lookups  = [...DEFAULT_LOOKUPS];
let _bookings = [..._seed.bookings];
let _patients = [..._seed.patients];
let _waitingList  = [];
let _clinic   = { ...DEFAULT_CLINIC };
let _users    = [
  { id: '11111111-1111-1111-1111-111111111111', username: 'admin',        full_name: 'System Administrator', email: 'admin@clinic.com',  role: 'admin',        status: 'active', must_change_password: false, failed_attempts: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '22222222-2222-2222-2222-222222222222', username: 'operator',     full_name: 'Lead Operator Ali',    email: 'ali@clinic.com',    role: 'operator',     status: 'active', must_change_password: false, failed_attempts: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '33333333-3333-3333-3333-333333333333', username: 'receptionist', full_name: 'Front Desk Sara',      email: 'sara@clinic.com',   role: 'receptionist', status: 'active', must_change_password: false, failed_attempts: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];
let _auditLogs = [];
let _dailyCounters = {};
let _counselingSessions = [];
let _counselingProcedures = [];

// ---------------------------------------------------------------------------
// API Object
// ---------------------------------------------------------------------------
export const api = {

  // --- DOCTORS & SHIFTS ---
  async getActiveDoctors() {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('doctors').select('*').eq('is_active', true).is('deleted_at', null).order('sort_order');
      if (data && data.length) return data;
    }
    return _doctors.filter(d => d.is_active);
  },

  async getAllDoctors() {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('doctors').select('*').is('deleted_at', null).order('sort_order');
      if (data && data.length) return data;
    }
    return [..._doctors];
  },

  async saveDoctor(doctor) {
    const user = getSession();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized: Admin role required to manage doctors.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('save_doctor_runtime', {
        p_admin_id: user.id,
        p_doctor: doctor,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Failed to save doctor.');
      broadcastEvent('doctor_change', data.doctor);
      return data.doctor;
    }
    if (doctor.id) {
      const idx = _doctors.findIndex(d => d.id === doctor.id);
      if (idx !== -1) { _doctors[idx] = { ..._doctors[idx], ...doctor }; broadcastEvent('doctor_change', _doctors[idx]); return _doctors[idx]; }
    }
    const nd = { id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: doctor.name || 'New Doctor', specialty: doctor.specialty || 'General', phone: doctor.phone || '', avatar_url: doctor.avatar_url || '', is_active: doctor.is_active ?? true, sort_order: doctor.sort_order || _doctors.length + 1 };
    _doctors.push(nd);
    broadcastEvent('doctor_change', nd);
    return nd;
  },

  async deleteDoctor(doctorId) {
    const user = getSession();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized: Admin role required to delete doctors.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('delete_doctor_runtime', {
        p_admin_id: user.id,
        p_doctor_id: doctorId,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Failed to delete doctor.');
      broadcastEvent('doctor_change', { id: doctorId, deleted: true });
      return;
    }
    _doctors = _doctors.filter(d => d.id !== doctorId);
    broadcastEvent('doctor_change', { id: doctorId, deleted: true });
  },

  async checkDoctorFutureBookings(doctorId) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('check_future_bookings', {
          p_doctor_id: doctorId,
        });
        if (!error && typeof data === 'number') return data;
      } catch (e) { console.warn(e); }
    }
    const today = todayDateString();
    return _bookings.filter(b => b.doctor_id === doctorId && b.booking_date >= today && b.status !== 'cancelled' && !b.deleted_at).length;
  },

  async getShifts(doctorId) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('shifts').select('*').eq('doctor_id', doctorId).eq('is_active', true).is('deleted_at', null).order('sort_order');
      if (data && data.length) return data;
    }
    return _shifts.filter(s => s.doctor_id === doctorId && s.is_active);
  },

  async getAllShifts() {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('shifts').select('*').is('deleted_at', null).order('sort_order');
      if (data && data.length) return data;
    }
    return [..._shifts];
  },

  async saveShift(shift) {
    const user = getSession();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized: Admin role required to manage shifts.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('save_shift_runtime', {
        p_admin_id: user.id,
        p_shift: shift,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Failed to save shift.');
      broadcastEvent('shift_change', data.shift);
      return data.shift;
    }
    if (shift.id) {
      const idx = _shifts.findIndex(s => s.id === shift.id);
      if (idx !== -1) { _shifts[idx] = { ..._shifts[idx], ...shift }; broadcastEvent('shift_change', _shifts[idx]); return _shifts[idx]; }
    }
    const ns = { id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, doctor_id: shift.doctor_id || '', name: shift.name || 'Shift', start_time: shift.start_time || '08:00', end_time: shift.end_time || '20:00', slot_duration_minutes: shift.slot_duration_minutes || 9, days_of_week: shift.days_of_week || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], max_walkins: shift.max_walkins || 10, is_active: shift.is_active ?? true, sort_order: shift.sort_order || _shifts.length + 1 };
    _shifts.push(ns);
    broadcastEvent('shift_change', ns);
    return ns;
  },

  async deleteShift(shiftId) {
    const user = getSession();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized: Admin role required to delete shifts.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('delete_shift_runtime', {
        p_admin_id: user.id,
        p_shift_id: shiftId,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Failed to delete shift.');
      broadcastEvent('shift_change', { id: shiftId, deleted: true });
      return;
    }
    _shifts = _shifts.filter(s => s.id !== shiftId);
    broadcastEvent('shift_change', { id: shiftId, deleted: true });
  },

  async checkShiftFutureBookings(shiftId) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('check_future_bookings', {
          p_shift_id: shiftId,
        });
        if (!error && typeof data === 'number') return data;
      } catch (e) { console.warn(e); }
    }
    const today = todayDateString();
    return _bookings.filter(b => b.shift_id === shiftId && b.booking_date >= today && b.status !== 'cancelled' && !b.deleted_at).length;
  },

  // --- CLINIC SETTINGS ---
  async getClinicInfo() {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('clinic_settings').select('value_json').eq('key_name', 'clinic_info').single();
      if (data?.value_json) return data.value_json;
    }
    return { ..._clinic };
  },

  async saveClinicInfo(settings) {
    _clinic = { ...settings };
    if (isSupabaseConfigured && supabase) {
      await supabase.from('clinic_settings').upsert({ key_name: 'clinic_info', value_json: settings });
    }
    return { ..._clinic };
  },

  // --- LOOKUP ITEMS ---
  async getLookupsByCategory(category) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('lookup_items').select('*').eq('category', category).eq('is_active', true).is('deleted_at', null).order('sort_order');
      if (data && data.length) return data;
    }
    return _lookups.filter(l => l.category === category && l.is_active);
  },

  async getAllLookups() {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('lookup_items').select('*').is('deleted_at', null).order('category').order('sort_order');
      if (data && data.length) return data;
    }
    return [..._lookups];
  },

  async saveLookupItem(item) {
    if (isSupabaseConfigured && supabase) {
      try {
        const isLocal = !item.id || ['src-','purp-','ca-','city-','area-'].some(p => item.id.startsWith(p)) || item.id.startsWith('lookup-');
        if (!isLocal) {
          const { data, error } = await supabase.from('lookup_items').update(item).eq('id', item.id).select().single();
          if (!error && data) return data;
        } else {
          const { id, ...payload } = item;
          const { data, error } = await supabase.from('lookup_items').insert([payload]).select().single();
          if (!error && data) return data;
        }
      } catch (e) { console.warn('saveLookupItem failed:', e); }
    }
    if (item.id) {
      const idx = _lookups.findIndex(l => l.id === item.id);
      if (idx !== -1) { _lookups[idx] = { ..._lookups[idx], ...item }; return _lookups[idx]; }
    }
    const nl = { id: `lookup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, category: item.category || 'source', name: item.name || '', color: item.color, parent_id: item.parent_id, is_active: item.is_active ?? true, sort_order: item.sort_order || _lookups.length + 1 };
    _lookups.push(nl); return nl;
  },

  async deleteLookupItem(id) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('lookup_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      return;
    }
    _lookups = _lookups.filter(l => l.id !== id);
  },

  // --- DAILY STATS ---
  async getDailyStats(date, doctorId, shiftId) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('get_daily_stat_cards', { p_date: date, p_doctor_id: doctorId, p_shift_id: shiftId });
      if (data) return data;
    }
    const shift = _shifts.find(s => s.id === shiftId);
    const slots = shift ? SlotEngine.generateSlots(shift, []) : [];
    const totalSlots = slots.length || 94;
    const active = _bookings.filter(b => b.booking_date === date && b.doctor_id === doctorId && b.shift_id === shiftId && !b.deleted_at && b.status !== 'cancelled');
    const total = active.length;
    let checkInCount = 0, inProcessCount = 0, pendingCount = 0, absentCount = 0, completedCount = 0, followUpCount = 0, remainingFollowUpCount = 0;
    const sourcesCount = {};
    for (const b of active) {
      if (b.status === 'checked_in') checkInCount++;
      else if (b.status === 'in_process') inProcessCount++;
      else if (b.status === 'pending') pendingCount++;
      else if (b.status === 'absent') absentCount++;
      else if (b.status === 'completed') completedCount++;
      if (b.status === 'follow_up' || b.purpose?.toLowerCase().includes('follow')) {
        followUpCount++;
        if (b.status === 'pending') remainingFollowUpCount++;
      }
      if (b.source) sourcesCount[b.source] = (sourcesCount[b.source] || 0) + 1;
    }
    const pct = (n, d) => d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
    const avail = Math.max(0, totalSlots - total);
    return { totalBookings: total, totalSlots, bookedSlots: total, bookedPercentage: pct(total, totalSlots), availableSlots: avail, availablePercentage: pct(avail, totalSlots), checkInCount, checkInPercentage: pct(checkInCount, total), inProcessCount, inProcessPercentage: pct(inProcessCount, total), pendingCount, pendingPercentage: pct(pendingCount, total), absentCount, absentPercentage: pct(absentCount, total), completedCount, followUpCount, followUpPercentage: pct(followUpCount, total), remainingFollowUpCount, remainingFollowUpPercentage: followUpCount > 0 ? pct(remainingFollowUpCount, followUpCount) : 100, sourcesCount };
  },

  // --- BOOKINGS ---
  async getBookingsForShiftAndDate(date, doctorId, shiftId) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('bookings').select('*, patient:patients(*), doctor:doctors(name), shift:shifts(name)').eq('booking_date', date).eq('doctor_id', doctorId).eq('shift_id', shiftId).is('deleted_at', null).order('slot_index');
      if (!error && data) return data.map(b => ({ ...b, doctor_name: b.doctor?.name, shift_name: b.shift?.name }));
    }
    return _bookings.filter(b => b.booking_date === date && b.doctor_id === doctorId && b.shift_id === shiftId && !b.deleted_at).sort((a, b) => a.slot_index - b.slot_index);
  },

  async createBookingAtomic(payload) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('create_booking_atomic', {
        p_doctor_id: payload.doctor_id, p_shift_id: payload.shift_id, p_booking_date: payload.booking_date,
        p_slot_index: payload.slot_index, p_slot_time: payload.slot_time, p_slot_time_formatted: payload.slot_time_formatted,
        p_reservation_type: payload.reservation_type, p_purpose: payload.purpose, p_source: payload.source,
        p_called_as: payload.called_as, p_first_name: payload.first_name, p_last_name: payload.last_name || null,
        p_cnic: payload.cnic || null, p_phone_code: payload.phone_code || '+92', p_phone_prefix: payload.phone_prefix || '300',
        p_phone_number: payload.phone_number || '', p_city: payload.city || null, p_area: payload.area || null,
        p_address: payload.address || null, p_age: payload.age || null, p_dob: payload.dob || null,
        p_remarks: payload.remarks || null, p_waiting_list_id: payload.waiting_list_id || null,
        p_created_by: payload.created_by || null, p_username: payload.username || 'system',
        p_existing_patient_id: payload.existing_patient_id || null,
      });
      // If the DB still has NOT NULL on token_number, fall back to direct insert with a placeholder token
      if (error) {
        if (error.message && (error.message.includes('token_number') || error.message.includes('token_code')) && error.message.includes('not-null')) {
          return await this._createBookingWithFallbackToken(payload);
        }
        throw new Error(error.message);
      }
      return data;
    }
    // Local fallback (no Supabase)
    return this._createBookingLocalFallback(payload);
  },

  // Fallback when remote DB still has NOT NULL on token columns:
  // inserts patient + booking directly with a negative placeholder token
  // (negative = never clashes with real tokens 1,2,3...).
  // checkin_booking replaces it with the real sequential token at check-in.
  async _createBookingWithFallbackToken(payload) {
    // Upsert patient first
    const fp = `${payload.phone_code || '+92'}${payload.phone_prefix || ''}${payload.phone_number || ''}`;
    let patientId = payload.existing_patient_id || null;
    if (!patientId) {
      // Try to find by CNIC or phone
      let patientQ = supabase.from('patients').select('id');
      if (payload.cnic) patientQ = patientQ.eq('cnic', payload.cnic);
      else patientQ = patientQ.eq('full_phone', fp);
      const { data: existingP } = await patientQ.maybeSingle();
      if (existingP) {
        patientId = existingP.id;
      } else {
        const { data: newP, error: pErr } = await supabase.from('patients').insert({
          first_name: payload.first_name, last_name: payload.last_name || null,
          cnic: payload.cnic || null, phone_code: payload.phone_code || '+92',
          phone_prefix: payload.phone_prefix || '300', phone_number: payload.phone_number || '',
          full_phone: fp, city: payload.city || null, area: payload.area || null,
          age: payload.age || null, patient_mrn: `MRN-${Date.now().toString().slice(-6)}`,
        }).select('id').single();
        if (pErr) throw new Error(pErr.message);
        patientId = newP.id;
      }
    }
    // Placeholder token: large negative number so it never conflicts
    const placeholderToken = -(Math.floor(Date.now() % 10000000) + Math.floor(Math.random() * 999));
    const { data: bData, error: bErr } = await supabase.from('bookings').insert({
      doctor_id: payload.doctor_id, shift_id: payload.shift_id,
      booking_date: payload.booking_date, patient_id: patientId,
      slot_index: payload.slot_index || 1, slot_time: payload.slot_time || '08:00',
      slot_time_formatted: payload.slot_time_formatted || '8:00 AM',
      token_number: placeholderToken, token_code: 'Pending',
      reservation_type: payload.reservation_type, purpose: payload.purpose,
      source: payload.source || 'Walk-in', called_as: payload.called_as || 'Hospital Patient',
      status: 'pending', remarks: payload.remarks || null,
      created_by: payload.created_by || null,
    }).select('*, patient:patients(*), doctor:doctors(name), shift:shifts(name)').single();
    if (bErr) throw new Error(bErr.message);
    return { ...bData, doctor_name: bData.doctor?.name, shift_name: bData.shift?.name };
  },

  _createBookingLocalFallback(payload) {
    const fp = `${payload.phone_code || '+92'}${payload.phone_prefix || ''}${payload.phone_number || ''}`;
    let patient = payload.existing_patient_id
      ? _patients.find(p => p.id === payload.existing_patient_id)
      : _patients.find(p => (payload.cnic && p.cnic === payload.cnic) || (fp.length >= 10 && p.full_phone === fp));
    if (!patient) {
      patient = { id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, patient_mrn: `MRN-${Math.floor(10000 + Math.random() * 90000)}`, first_name: payload.first_name, last_name: payload.last_name, cnic: payload.cnic, phone_code: payload.phone_code || '+92', phone_prefix: payload.phone_prefix || '300', phone_number: payload.phone_number || '', full_phone: fp, city: payload.city, area: payload.area, address: payload.address, age: payload.age };
      _patients.push(patient);
    }
    // Step 4 New Token Rule: No token generated at booking time!
    const nb = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      booking_date: payload.booking_date,
      doctor_id: payload.doctor_id,
      shift_id: payload.shift_id,
      patient_id: patient.id,
      slot_index: payload.slot_index || (_bookings.length + 1),
      slot_time: payload.slot_time,
      slot_time_formatted: payload.slot_time_formatted,
      token_number: null,
      token_code: null,
      purpose: payload.purpose,
      reservation_type: payload.reservation_type,
      source: payload.source,
      called_as: payload.called_as,
      status: 'pending',
      remarks: payload.remarks,
      created_by: payload.created_by,
      reprinted_count: 0,
      check_in_time: null,
      checked_in_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      patient,
      doctor_name: _doctors.find(d => d.id === payload.doctor_id)?.name || '',
      shift_name: _shifts.find(s => s.id === payload.shift_id)?.name || ''
    };
    _bookings.push(nb);
    broadcastEvent('booking_created', nb);
    return nb;
  },

  // --- STEP 4: ATOMIC SINGLE-SEQUENCE CHECK-IN ---
  async checkinBooking(bookingId) {
    const user = getSession();
    if (!user || (user.role !== 'receptionist' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Only Receptionist and Admin can check in patients.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('checkin_booking', {
        p_booking_id: bookingId,
        p_user_id: user.id,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Check-in failed.');
      broadcastEvent('booking_checkin', data.booking || { id: bookingId, token_number: data.token_number });
      return data;
    }
    // Local fallback
    const b = _bookings.find(x => x.id === bookingId);
    if (!b) throw new Error('Booking not found');
    if (b.status === 'checked_in' && b.token_number) {
      return { success: true, already_checked_in: true, token_number: b.token_number, token_code: String(b.token_number), booking: b };
    }
    // Single numeric sequence per doctor, shift, date
    const counterKey = `${b.doctor_id}_${b.shift_id}_${b.booking_date}`;
    if (_dailyCounters[counterKey] === undefined) {
      const issuedTokens = _bookings
        .filter(x => x.doctor_id === b.doctor_id && x.shift_id === b.shift_id && x.booking_date === b.booking_date && x.token_number)
        .map(x => x.token_number);
      _dailyCounters[counterKey] = issuedTokens.length > 0 ? Math.max(...issuedTokens) : 0;
    }
    _dailyCounters[counterKey] += 1;
    const nextToken = _dailyCounters[counterKey];

    b.token_number = nextToken;
    b.token_code = String(nextToken);
    b.status = 'checked_in';
    b.check_in_time = new Date().toISOString();
    b.checked_in_at = b.check_in_time;
    b.updated_at = b.check_in_time;

    // Auto-create counseling session if purpose requires counseling
    const purposeItem = _lookups.find(l => l.category === 'purpose' && l.name?.toLowerCase() === b.purpose?.toLowerCase());
    const reqCounseling = purposeItem ? (purposeItem.requires_counseling !== false && (purposeItem.requires_counseling || purposeItem.name?.toLowerCase() === 'consultation')) : (b.purpose?.toLowerCase() === 'consultation');
    if (reqCounseling) {
      if (!_counselingSessions.find(cs => cs.booking_id === b.id)) {
        _counselingSessions.push({
          id: `cs-${b.id}`,
          booking_id: b.id,
          status: 'waiting',
          counselor_id: null,
          started_at: null,
          completed_at: null,
          notes: '',
          created_at: new Date().toISOString()
        });
      }
      b.counseling_status = 'waiting';
    }

    broadcastEvent('booking_checkin', b);
    return { success: true, already_checked_in: false, token_number: nextToken, token_code: String(nextToken), checked_in_at: b.checked_in_at, booking: b };
  },

  async undoCheckinBooking(bookingId) {
    const user = getSession();
    if (!user || (user.role !== 'receptionist' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Receptionist or Admin role required.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('undo_checkin_booking', {
        p_booking_id: bookingId,
        p_user_id: user.id,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Undo check-in failed.');
      broadcastEvent('booking_undo_checkin', { id: bookingId });
      return data;
    }
    const b = _bookings.find(x => x.id === bookingId);
    if (b) {
      b.status = 'pending';
      // Token stays voided in history, never reused
      broadcastEvent('booking_undo_checkin', { id: bookingId });
    }
    return { success: true };
  },

  async reprintToken(bookingId) {
    const user = getSession();
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('reprint_token', {
        p_booking_id: bookingId,
        p_user_id: user?.id,
      });
      if (error) throw new Error(error.message);
      return data;
    }
    const b = _bookings.find(x => x.id === bookingId);
    if (!b) throw new Error('Booking not found');
    b.reprinted_count = (b.reprinted_count || 0) + 1;
    return { success: true, token_number: b.token_number };
  },

  // --- STEP 3: RECEPTION DASHBOARD HELPERS ---
  async getDoctorWorkload(dateStr = todayDateString()) {
    const doctors = await this.getDoctors();
    let bookings = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('bookings').select('doctor_id, status, deleted_at').eq('booking_date', dateStr).is('deleted_at', null);
      if (data) bookings = data;
    } else {
      bookings = _bookings.filter(b => b.booking_date === dateStr && !b.deleted_at);
    }
    return doctors.map(doc => {
      const docBookings = bookings.filter(b => b.doctor_id === doc.id && b.status !== 'cancelled');
      const pendingCount = docBookings.filter(b => b.status === 'pending').length;
      const checkedInCount = docBookings.filter(b => b.status === 'checked_in' || b.status === 'in_process' || b.status === 'completed').length;
      return {
        id: doc.id,
        name: doc.name,
        specialty: doc.specialty,
        avatar_url: doc.avatar_url,
        total_bookings: docBookings.length,
        pending_count: pendingCount,
        checked_in_count: checkedInCount,
        last_updated: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      };
    });
  },

  async getReceptionBookings(doctorId, dateStr = todayDateString(), statusFilter = 'pending') {
    if (isSupabaseConfigured && supabase) {
      // NOTE: do NOT join counseling_sessions here — it causes a schema error on some DBs
      let q = supabase.from('bookings')
        .select('*, patient:patients(*), doctor:doctors(name), shift:shifts(name)')
        .eq('booking_date', dateStr)
        .is('deleted_at', null);
      if (doctorId) q = q.eq('doctor_id', doctorId);
      if (statusFilter === 'pending') {
        q = q.eq('status', 'pending').order('slot_index');
      } else if (statusFilter === 'checked_in') {
        q = q.in('status', ['checked_in', 'in_process', 'completed'])
              .order('token_number', { ascending: true, nullsFirst: false });
      } else {
        // 'all' — no status filter, fetch everything for this doctor+date
        q = q.order('slot_index');
      }
      const { data, error } = await q;
      if (!error && data) {
        return data.map(b => ({
          ...b,
          doctor_name: b.doctor?.name,
          shift_name: b.shift?.name,
          counseling_status: null, // fetched separately if needed
        }));
      }
      if (error) console.warn('getReceptionBookings Supabase error:', error.message);
    }
    // Local in-memory fallback
    let all = _bookings.filter(b => b.booking_date === dateStr && !b.deleted_at && b.status !== 'cancelled');
    if (doctorId) all = all.filter(b => b.doctor_id === doctorId);
    if (statusFilter === 'pending') {
      return all.filter(b => b.status === 'pending').sort((a, b) => a.slot_index - b.slot_index);
    } else if (statusFilter === 'checked_in') {
      return all.filter(b => b.status === 'checked_in' || b.status === 'in_process' || b.status === 'completed')
                .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));
    }
    // 'all'
    return all.sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0));
  },

  async searchReceptionBookings(searchQuery, dateStr = todayDateString()) {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    if (isSupabaseConfigured && supabase) {
      const isNum = /^\d+$/.test(q);
      let query = supabase.from('bookings')
        .select('*, patient:patients(*), doctor:doctors(name), shift:shifts(name)')
        .eq('booking_date', dateStr)
        .is('deleted_at', null);
      if (isNum) {
        query = query.or(`token_number.eq.${parseInt(q, 10)},slot_index.eq.${parseInt(q, 10)}`);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.filter(b => {
          if (isNum && (b.token_number === parseInt(q, 10) || b.slot_index === parseInt(q, 10))) return true;
          const p = b.patient;
          if (!p) return false;
          return (p.first_name && p.first_name.toLowerCase().includes(q)) ||
                 (p.last_name && p.last_name.toLowerCase().includes(q)) ||
                 (p.full_phone && p.full_phone.includes(q)) ||
                 (p.patient_mrn && p.patient_mrn.toLowerCase().includes(q));
        }).map(b => ({ ...b, doctor_name: b.doctor?.name, shift_name: b.shift?.name }));
      }
    }
    return _bookings.filter(b => {
      if (b.booking_date !== dateStr || b.deleted_at) return false;
      if (b.token_number && String(b.token_number) === q) return true;
      const p = b.patient;
      if (!p) return false;
      return (p.first_name && p.first_name.toLowerCase().includes(q)) ||
             (p.last_name && p.last_name.toLowerCase().includes(q)) ||
             (p.full_phone && p.full_phone.includes(q)) ||
             (p.patient_mrn && p.patient_mrn.toLowerCase().includes(q));
    });
  },

  async updateBookingStatus(bookingId, status, userId, username, reason) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('update_booking_status', { p_booking_id: bookingId, p_status: status, p_user_id: userId, p_username: username, p_reason: reason || null });
      if (!error && data) { broadcastEvent('booking_updated', data); return data; }
    }
    const b = _bookings.find(b => b.id === bookingId);
    if (!b) throw new Error('Booking not found');
    b.status = status; b.updated_at = new Date().toISOString();
    if (status === 'checked_in') b.check_in_time = new Date().toISOString();
    if (status === 'in_process') b.in_process_time = new Date().toISOString();
    if (status === 'completed') b.completed_time = new Date().toISOString();
    if (status === 'absent') b.absent_time = new Date().toISOString();
    broadcastEvent('booking_updated', { ...b });
    return { ...b };
  },

  async reprintToken(bookingId, userId, username, format = '80mm') {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('reprint_token', { p_booking_id: bookingId, p_user_id: userId, p_username: username, p_format: format });
      if (!error && data) return data;
    }
    const b = _bookings.find(b => b.id === bookingId);
    if (!b) throw new Error('Booking not found');
    b.reprinted_count = (b.reprinted_count || 0) + 1;
    return { ...b };
  },

  async softDeleteBooking(bookingId, userId, username) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('bookings').update({ deleted_at: new Date().toISOString() }).eq('id', bookingId);
      await supabase.from('audit_logs').insert([{ user_id: userId, username, action_type: 'booking_delete', entity_type: 'booking', entity_id: bookingId, details_json: { booking_id: bookingId } }]);
      broadcastEvent('booking_deleted', { id: bookingId }); return true;
    }
    const b = _bookings.find(b => b.id === bookingId);
    if (!b) return false;
    b.deleted_at = new Date().toISOString();
    broadcastEvent('booking_deleted', { id: bookingId }); return true;
  },

  async editBooking(bookingId, changes, userId, username) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('bookings').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', bookingId).select('*, patient:patients(*), doctor:doctors(name), shift:shifts(name)').single();
      if (!error && data) { broadcastEvent('booking_updated', data); return data; }
    }
    const b = _bookings.find(b => b.id === bookingId);
    if (!b) throw new Error('Booking not found');
    Object.assign(b, changes, { updated_at: new Date().toISOString() });
    broadcastEvent('booking_updated', { ...b });
    return { ...b };
  },

  // --- WAITING LIST ---
  async getWaitingList(date, doctorId, shiftId) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('waiting_list').select('*').eq('booking_date', date).eq('doctor_id', doctorId).eq('shift_id', shiftId).eq('status', 'waiting').is('deleted_at', null).order('priority').order('created_at');
      if (data) return data;
    }
    return _waitingList.filter(w => w.booking_date === date && w.doctor_id === doctorId && w.shift_id === shiftId && w.status === 'waiting');
  },

  async addWaitingListItem(item) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('waiting_list').insert([{ ...item, status: 'waiting' }]).select().single();
      if (!error && data) { broadcastEvent('waiting_list_added', data); return data; }
    }
    const ni = { ...item, id: `wait-${Date.now()}`, status: 'waiting', created_at: new Date().toISOString() };
    _waitingList.push(ni); broadcastEvent('waiting_list_added', ni); return ni;
  },

  async cancelWaitingListItem(id) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('waiting_list').update({ status: 'cancelled' }).eq('id', id); return;
    }
    const w = _waitingList.find(w => w.id === id);
    if (w) w.status = 'cancelled';
  },

  // --- PATIENT SEARCH ---
  async searchPatients(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('patients').select('*').or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,full_phone.ilike.%${q}%,cnic.ilike.%${q}%,patient_mrn.ilike.%${q}%`).is('deleted_at', null).limit(10);
      if (data && data.length) return data;
    }
    return _patients.filter(p => p.first_name?.toLowerCase().includes(q) || p.last_name?.toLowerCase().includes(q) || p.full_phone?.includes(q) || p.cnic?.includes(q) || p.patient_mrn?.toLowerCase().includes(q)).slice(0, 10);
  },

  async getPatientHistory(patientId) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('bookings').select('*, doctor:doctors(name), shift:shifts(name)').eq('patient_id', patientId).is('deleted_at', null).order('booking_date', { ascending: false });
      if (data) return data.map(b => ({ ...b, doctor_name: b.doctor?.name, shift_name: b.shift?.name }));
    }
    return _bookings.filter(b => b.patient_id === patientId && !b.deleted_at).sort((a, b) => b.booking_date.localeCompare(a.booking_date));
  },

  // --- USERS ---
  async getUsers() {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('user_profiles').select('*').is('deleted_at', null).order('created_at');
      if (data && data.length) return data;
    }
    return [..._users.filter(u => !u.deleted_at)];
  },

  async saveUser(user) {
    if (isSupabaseConfigured && supabase) {
      try {
        if (user.id && !user.id.startsWith('u-')) {
          const { data, error } = await supabase.from('user_profiles').update(user).eq('id', user.id).select().single();
          if (!error && data) return data;
        } else {
          const { id, ...payload } = user;
          const { data, error } = await supabase.from('user_profiles').insert([payload]).select().single();
          if (!error && data) return data;
        }
      } catch (e) { console.warn('saveUser failed:', e); }
    }
    if (user.id) {
      const idx = _users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        const ex = _users[idx];
        if (ex.role === 'admin' && (user.role !== 'admin' || user.status === 'disabled')) {
          const activeAdmins = _users.filter(u => u.role === 'admin' && u.status === 'active' && !u.deleted_at);
          if (activeAdmins.length <= 1) throw new Error('The last active Administrator cannot be demoted or disabled.');
        }
        _users[idx] = { ..._users[idx], ...user, updated_at: new Date().toISOString() };
        return _users[idx];
      }
    }
    const nu = { id: `u-${Date.now()}`, username: user.username || '', full_name: user.full_name || '', email: user.email, role: user.role || 'operator', status: user.status || 'active', must_change_password: true, failed_attempts: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    _users.push(nu); return nu;
  },

  async deleteUser(userId) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('user_profiles').update({ deleted_at: new Date().toISOString(), status: 'disabled' }).eq('id', userId); return;
    }
    _users = _users.filter(u => u.id !== userId);
  },

  // --- AUDIT LOGS ---
  async getAuditLogs(limit = 100) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (data && data.length) return data;
    }
    return _auditLogs.slice(0, limit);
  },

  // --- REPORTS ---
  async getReportOverview(startDate, endDate, doctorId, source) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_overview', { p_start_date: startDate, p_end_date: endDate, p_doctor_id: doctorId || null, p_source: source || null });
      if (data) return data;
    }
    const f = _bookings.filter(b => b.booking_date >= startDate && b.booking_date <= endDate && (!doctorId || b.doctor_id === doctorId) && (!source || b.source === source) && !b.deleted_at && b.status !== 'cancelled');
    const total = f.length, checkedIn = f.filter(b => b.status === 'checked_in').length, completed = f.filter(b => b.status === 'completed').length, absent = f.filter(b => b.status === 'absent').length;
    const dm = new Map();
    for (const b of f) { if (!dm.has(b.booking_date)) dm.set(b.booking_date, { date: b.booking_date, bookings: 0, checked_in: 0, absent: 0 }); const r = dm.get(b.booking_date); r.bookings++; if (b.status === 'checked_in' || b.status === 'completed') r.checked_in++; if (b.status === 'absent') r.absent++; }
    return { totalBookings: total, checkedIn, completed, absent, absentRate: total > 0 ? Math.round((absent / total) * 1000) / 10 : 0, avgPerDay: Math.round((total / Math.max(1, dm.size)) * 10) / 10, dailyTrend: Array.from(dm.values()).sort((a, b) => a.date.localeCompare(b.date)) };
  },

  async getReportBookingsBySource(startDate, endDate, doctorId) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_bookings_by_source', { p_start_date: startDate, p_end_date: endDate, p_doctor_id: doctorId || null });
      if (data) return data;
    }
    const f = _bookings.filter(b => b.booking_date >= startDate && b.booking_date <= endDate && (!doctorId || b.doctor_id === doctorId) && !b.deleted_at && b.status !== 'cancelled');
    const total = f.length;
    const sm = new Map();
    for (const b of f) { const s = b.source || 'Other'; if (!sm.has(s)) sm.set(s, { source: s, count: 0, checked_in: 0, completed: 0, absent: 0 }); const r = sm.get(s); r.count++; if (b.status === 'checked_in') r.checked_in++; if (b.status === 'completed') r.completed++; if (b.status === 'absent') r.absent++; }
    const sources = Array.from(sm.values()).map(r => ({ ...r, percentage: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0, conversion_rate: r.count > 0 ? Math.round(((r.checked_in + r.completed) / r.count) * 1000) / 10 : 0 })).sort((a, b) => b.count - a.count);
    return { totalBookings: total, sources };
  },

  async getReportTrends(startDate, endDate, doctorId, groupBy = 'day') {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_booking_trends', { p_start_date: startDate, p_end_date: endDate, p_doctor_id: doctorId || null, p_group_by: groupBy });
      if (data) return data;
    }
    const f = _bookings.filter(b => b.booking_date >= startDate && b.booking_date <= endDate && (!doctorId || b.doctor_id === doctorId) && !b.deleted_at && b.status !== 'cancelled');
    const m = new Map();
    for (const b of f) { const p = b.booking_date; if (!m.has(p)) m.set(p, { period: p, total_bookings: 0, appointments: 0, walk_ins: 0, attended: 0, absent: 0 }); const r = m.get(p); r.total_bookings++; if (b.reservation_type === 'Appointment') r.appointments++; if (b.reservation_type === 'Walk-in') r.walk_ins++; if (b.status === 'checked_in' || b.status === 'completed') r.attended++; if (b.status === 'absent') r.absent++; }
    return Array.from(m.values()).sort((a, b) => a.period.localeCompare(b.period));
  },

  async getReportPeakHours(startDate, endDate, doctorId) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_peak_hours', { p_start_date: startDate, p_end_date: endDate, p_doctor_id: doctorId || null });
      if (data) return data;
    }
    const f = _bookings.filter(b => b.booking_date >= startDate && b.booking_date <= endDate && (!doctorId || b.doctor_id === doctorId) && !b.deleted_at && b.status !== 'cancelled');
    const hm = new Map(); for (let h = 8; h <= 21; h++) hm.set(h, 0);
    const dm = new Map(); ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].forEach(d => dm.set(d, 0));
    for (const b of f) { if (b.slot_time) { const h = parseInt(b.slot_time.split(':')[0], 10); if (hm.has(h)) hm.set(h, hm.get(h) + 1); } const dObj = new Date(`${b.booking_date}T12:00:00+05:00`); const dn = dObj.toLocaleDateString('en-US', { weekday: 'long' }); if (dm.has(dn)) dm.set(dn, dm.get(dn) + 1); }
    return { hourlyDistribution: Array.from(hm.entries()).map(([hour_num, bookings_count]) => ({ hour_num, hour_label: formatTime12h(hour_num * 60), bookings_count })), weekdayDistribution: Array.from(dm.entries()).map(([weekday_name, bookings_count]) => ({ weekday_name, bookings_count })) };
  },

  async getReportUserPerformance(startDate, endDate) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_user_performance', { p_start_date: startDate, p_end_date: endDate });
      if (data) return data;
    }
    return _users.map(u => { const ub = _bookings.filter(b => b.booking_date >= startDate && b.booking_date <= endDate && b.created_by === u.id && !b.deleted_at); return { user_id: u.id, username: u.username, full_name: u.full_name, role: u.role, bookings_created: ub.length, appointments_created: ub.filter(b => b.reservation_type === 'Appointment').length, walkins_created: ub.filter(b => b.reservation_type === 'Walk-in').length, attended_count: ub.filter(b => b.status === 'checked_in' || b.status === 'completed').length, absent_count: ub.filter(b => b.status === 'absent').length }; });
  },

  async getReportDoctorShift(startDate, endDate) {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_doctor_shift_utilisation', { p_start_date: startDate, p_end_date: endDate });
      if (data) return data;
    }
    return _shifts.map(s => { const doc = _doctors.find(d => d.id === s.doctor_id); const sb = _bookings.filter(b => b.booking_date >= startDate && b.booking_date <= endDate && b.shift_id === s.id && !b.deleted_at); return { doctor_id: s.doctor_id, doctor_name: doc?.name || '', shift_id: s.id, shift_name: s.name, slot_duration_minutes: s.slot_duration_minutes, total_booked: sb.length, appointments_count: sb.filter(b => b.reservation_type === 'Appointment').length, walkins_count: sb.filter(b => b.reservation_type === 'Walk-in').length, completed_count: sb.filter(b => b.status === 'completed' || b.status === 'checked_in').length, absent_count: sb.filter(b => b.status === 'absent').length }; });
  },

  async getReportTokens(startDate, endDate, doctorId) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.rpc('report_tokens_summary', { p_start_date: startDate, p_end_date: endDate, p_doctor_id: doctorId || null });
        if (data && data.dailyTokens) return data;
      } catch (e) { console.warn(e); }
    }
    const f = _bookings.filter(b => b.booking_date >= startDate && b.booking_date <= endDate && (!doctorId || b.doctor_id === doctorId) && !b.deleted_at);
    const dm = new Map();
    let totalWaitMins = 0;
    let waitCount = 0;

    for (const b of f) {
      if (!dm.has(b.booking_date)) {
        dm.set(b.booking_date, { date: b.booking_date, total_tokens: 0, reprint_count: 0, voided_tokens: 0, total_wait: 0, wait_count: 0 });
      }
      const r = dm.get(b.booking_date);
      if (b.token_number) {
        r.total_tokens++;
        if (b.slot_time && b.checked_in_at) {
          try {
            const [sh, sm] = b.slot_time.split(':').map(Number);
            const cin = new Date(b.checked_in_at);
            const slotMins = sh * 60 + sm;
            const cinMins = cin.getHours() * 60 + cin.getMinutes();
            const diff = Math.max(0, cinMins - slotMins);
            r.total_wait += diff;
            r.wait_count++;
            totalWaitMins += diff;
            waitCount++;
          } catch {}
        }
      }
      r.reprint_count += b.reprinted_count || 0;
      if (b.status === 'cancelled' || b.status === 'absent') r.voided_tokens++;
    }

    const tokenedList = f.filter(b => b.token_number);
    const avgOverall = waitCount > 0 ? `${Math.round(totalWaitMins / waitCount)} mins` : '—';
    const dailyTokens = Array.from(dm.values()).map(d => ({
      date: d.date,
      total_tokens: d.total_tokens,
      reprint_count: d.reprint_count,
      voided_tokens: d.voided_tokens,
      avg_wait: d.wait_count > 0 ? `${Math.round(d.total_wait / d.wait_count)} mins` : '—',
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalTokensIssued: tokenedList.length,
      totalReprints: f.reduce((a, b) => a + (b.reprinted_count || 0), 0),
      voidedTokens: f.filter(b => b.status === 'cancelled' || b.status === 'absent').length,
      avgWaitTime: avgOverall,
      dailyTokens
    };
  },

  async getReportAbsentAndFollowup(startDate, endDate, doctorId, filterType = 'all') {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_absent_and_followup', { p_start_date: startDate, p_end_date: endDate, p_doctor_id: doctorId || null, p_filter_type: filterType });
      if (data) return data;
    }
    return _bookings.filter(b => {
      if (b.booking_date < startDate || b.booking_date > endDate || b.deleted_at) return false;
      if (doctorId && b.doctor_id !== doctorId) return false;
      if (filterType === 'absent') return b.status === 'absent';
      if (filterType === 'follow_up') return b.status === 'follow_up' || b.purpose?.toLowerCase().includes('follow');
      return b.status === 'absent' || b.status === 'follow_up' || b.purpose?.toLowerCase().includes('follow');
    }).map(b => ({ booking_id: b.id, booking_date: b.booking_date, token_code: b.token_code, slot_time_formatted: b.slot_time_formatted, status: b.status, purpose: b.purpose, source: b.source, remarks: b.remarks, patient_id: b.patient_id, patient_mrn: b.patient?.patient_mrn || '', first_name: b.patient?.first_name || 'Patient', last_name: b.patient?.last_name || '', full_phone: b.patient?.full_phone || '', city: b.patient?.city || '', area: b.patient?.area || '', doctor_name: b.doctor_name || '' })).sort((a, b) => b.booking_date.localeCompare(a.booking_date));
  },

  // --- COUNSELING MODULE ---

  async getActiveProcedures() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('category')
        .order('sort_order');
      if (!error && data) return data;
    }
    // Local fallback: minimal built-in list
    return [
      { id: 'proc-1', name: 'Sleeve Gastrectomy (Laparoscopic)',   category: 'Bariatric Surgery',  is_active: true, sort_order: 1 },
      { id: 'proc-2', name: 'Roux-en-Y Gastric Bypass',            category: 'Bariatric Surgery',  is_active: true, sort_order: 2 },
      { id: 'proc-3', name: 'Mini Gastric Bypass',                 category: 'Bariatric Surgery',  is_active: true, sort_order: 3 },
      { id: 'proc-4', name: 'Laparoscopic Cholecystectomy',        category: 'Laparoscopic Surgery', is_active: true, sort_order: 10 },
      { id: 'proc-5', name: 'Consultation Fee',                    category: 'Consultation',       is_active: true, sort_order: 60 },
    ];
  },

  async getAllProcedures() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .is('deleted_at', null)
        .order('category')
        .order('sort_order');
      if (!error && data) return data;
    }
    return this.getActiveProcedures();
  },

  async saveProcedure(procedure) {
    const user = getSession();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized: Admin role required to manage procedures.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('save_procedure_runtime', {
        p_admin_id: user.id,
        p_procedure: procedure,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Failed to save procedure.');
      broadcastEvent('procedure_change', data.procedure);
      return data.procedure;
    }
    return { id: `proc-${Date.now()}`, ...procedure };
  },

  async deleteProcedure(procedureId) {
    const user = getSession();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized: Admin role required to delete procedures.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('delete_procedure_runtime', {
        p_admin_id: user.id,
        p_procedure_id: procedureId,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Failed to delete procedure.');
      broadcastEvent('procedure_change', { id: procedureId, deleted: true });
      return;
    }
  },

  async getCounselingQueue(date, doctorId = null) {
    const user = getSession();
    if (!user || !['admin', 'counselor'].includes(user.role)) {
      throw new Error('Unauthorized: Only Counselor and Admin can view counseling queue.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('get_counseling_queue', {
        p_date: date,
        p_doctor_id: doctorId,
      });
      if (error) throw new Error(error.message);
      return data || [];
    }
    // Local fallback: return sessions from _counselingSessions
    return _counselingSessions
      .map(cs => {
        const b = _bookings.find(x => x.id === cs.booking_id);
        if (!b || b.booking_date !== date || b.deleted_at) return null;
        if (doctorId && b.doctor_id !== doctorId) return null;
        return {
          session_id: cs.id,
          booking_id: b.id,
          counseling_status: cs.status,
          token_number: b.token_number,
          purpose: b.purpose,
          source: b.source,
          reservation_type: b.reservation_type,
          called_as: b.called_as,
          check_in_time: b.check_in_time,
          checked_in_at: b.checked_in_at,
          doctor_id: b.doctor_id,
          doctor_name: b.doctor_name,
          first_name: b.patient?.first_name,
          last_name: b.patient?.last_name,
          age: b.patient?.age,
          full_phone: b.patient?.full_phone,
          patient_mrn: b.patient?.patient_mrn,
          patient_id: b.patient_id,
          notes: cs.notes
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.token_number || 9999) - (b.token_number || 9999));
  },

  async getCounselingSessionDetail(sessionId) {
    const user = getSession();
    if (!user || !['admin', 'counselor'].includes(user.role)) {
      throw new Error('Unauthorized: Prices are confidential to Counselor and Admin.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('get_counseling_session_detail', {
        p_session_id: sessionId,
      });
      if (error) throw new Error(error.message);
      return data;
    }
    // Local fallback
    const cs = _counselingSessions.find(x => x.id === sessionId);
    if (!cs) return { success: false, error: 'Session not found' };
    const procs = _counselingProcedures.filter(x => x.session_id === sessionId);
    return { success: true, session: cs, procedures: procs };
  },

  async counselingCheckin(bookingId) {
    const user = getSession();
    if (!user || (user.role !== 'counselor' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Only Counselor or Admin can start counseling.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('counseling_checkin', {
        p_booking_id: bookingId,
        p_user_id: user.id,
      });
      if (error) throw new Error(error.message);
      broadcastEvent('counseling_change', { booking_id: bookingId, status: 'in_counseling' });
      return data;
    }
    let cs = _counselingSessions.find(x => x.booking_id === bookingId);
    if (!cs) {
      cs = { id: `cs-${bookingId}`, booking_id: bookingId, status: 'in_counseling', counselor_id: user.id, started_at: new Date().toISOString() };
      _counselingSessions.push(cs);
    } else {
      cs.status = 'in_counseling';
      cs.counselor_id = user.id;
      cs.started_at = cs.started_at || new Date().toISOString();
    }
    const b = _bookings.find(x => x.id === bookingId);
    if (b) b.counseling_status = 'in_counseling';
    broadcastEvent('counseling_change', { booking_id: bookingId, status: 'in_counseling' });
    return { success: true, already_started: false, session: cs };
  },

  async saveCounseling(bookingId, items, notes, complete) {
    const user = getSession();
    if (!user || (user.role !== 'counselor' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Only Counselor or Admin can save counseling.');
    }
    // Validate prices
    for (const item of items) {
      if ((parseFloat(item.quoted_price) || 0) < 0) {
        throw new Error('Price cannot be negative.');
      }
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('save_counseling', {
        p_booking_id: bookingId,
        p_user_id: user.id,
        p_items: items,
        p_notes: notes || null,
        p_complete: complete,
      });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || 'Failed to save counseling.');
      broadcastEvent('counseling_change', { booking_id: bookingId, status: complete ? 'done' : 'in_counseling' });
      return data;
    }
    let cs = _counselingSessions.find(x => x.booking_id === bookingId);
    if (!cs) throw new Error('No counseling session found.');
    // Atomically replace procedure list
    _counselingProcedures = _counselingProcedures.filter(x => x.session_id !== cs.id);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      _counselingProcedures.push({
        id: `cp-${Date.now()}-${i}`,
        session_id: cs.id,
        procedure_id: it.procedure_id,
        procedure_name_snapshot: it.procedure_name_snapshot,
        quoted_price: parseFloat(it.quoted_price) || 0,
        sort_order: i
      });
    }
    cs.notes = notes || cs.notes;
    if (complete) {
      cs.status = 'done';
      cs.completed_at = new Date().toISOString();
    }
    const b = _bookings.find(x => x.id === bookingId);
    if (b && complete) b.counseling_status = 'done';
    const total = items.reduce((s, it) => s + (parseFloat(it.quoted_price) || 0), 0);
    broadcastEvent('counseling_change', { booking_id: bookingId, status: cs.status });
    return { success: true, session: cs, total };
  },

  async undoCounselingCheckin(bookingId) {
    const user = getSession();
    if (!user || (user.role !== 'counselor' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Only Counselor or Admin can undo counseling check-in.');
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('undo_counseling_checkin', {
        p_booking_id: bookingId,
        p_user_id: user.id,
      });
      if (error) throw new Error(error.message);
      broadcastEvent('counseling_change', { booking_id: bookingId, status: 'waiting' });
      return data;
    }
    return { success: true };
  },

  async reprintCounselingSlip(sessionId) {
    const user = getSession();
    if (isSupabaseConfigured && supabase) {
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        username: user?.username || 'unknown',
        user_role: user?.role || 'unknown',
        action_type: 'reprint_counseling_slip',
        entity_type: 'counseling_session',
        entity_id: sessionId,
        details_json: { reprinted_at: new Date().toISOString() },
      }]);
    }
    return { success: true };
  },

  async getBookingWithPatient(bookingId) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, patient:patients(*), doctor:doctors(name)')
        .eq('id', bookingId)
        .single();
      if (!error && data) {
        return { ...data, doctor_name: data.doctor?.name };
      }
    }
    const b = _bookings.find(x => x.id === bookingId);
    return b || null;
  },

  // --- REALTIME ---
  subscribeToRealtime(onBookingChange, onStatusChange) {
    let unsub = () => {};
    if (isSupabaseConfigured && supabase) {
      const ch = supabase.channel('pbr_realtime_feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, p => onBookingChange({ event: p.eventType === 'INSERT' ? 'booking_created' : p.eventType === 'UPDATE' ? 'booking_updated' : 'booking_deleted', record: p.new || p.old }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiting_list' }, p => onBookingChange({ event: 'waiting_list_change', record: p.new || p.old }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, p => onBookingChange({ event: 'patient_change', record: p.new || p.old }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, p => onBookingChange({ event: 'doctor_change', record: p.new || p.old }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, p => onBookingChange({ event: 'shift_change', record: p.new || p.old }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_token_counters' }, p => onBookingChange({ event: 'token_counter_change', record: p.new || p.old }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'counseling_sessions' }, p => onBookingChange({ event: p.eventType, table: 'counseling_sessions', record: p.new || p.old }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'procedures' }, p => onBookingChange({ event: 'procedure_change', record: p.new || p.old }))
        .subscribe(status => {
          if (status === 'SUBSCRIBED') onStatusChange?.('connected');
          else if (status === 'CLOSED') onStatusChange?.('disconnected');
          else onStatusChange?.('reconnecting');
        });
      unsub = () => supabase.removeChannel(ch);
    } else {
      onStatusChange?.('connected');
    }
    const handleBc = e => { if (e.data?.type && e.data?.payload) onBookingChange({ event: e.data.type, record: e.data.payload }); };
    if (syncChannel) syncChannel.addEventListener('message', handleBc);
    return () => { unsub(); if (syncChannel) syncChannel.removeEventListener('message', handleBc); };
  },
};
