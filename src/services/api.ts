// ==============================================================================
// PATIENT BOOKING REGISTER (HIMS FRONT-DESK)
// Unified Service Layer: Supabase RPC & Resilient In-Memory Fallback
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import {
  Doctor,
  Shift,
  LookupItem,
  Patient,
  Booking,
  DailyStatCardsData,
  WaitingListItem,
  UserProfile,
  AuditLog,
  ClinicSettings,
  BookingStatus,
} from '../types';
import { SlotEngine } from '../utils/slotEngine';
import { getTodayDateString } from '../utils/dateUtils';

// Cross-tab BroadcastChannel for realtime sync when testing multi-window
const syncChannel = typeof window !== 'undefined' ? new BroadcastChannel('pbr_realtime_events') : null;

// Initial Mock Dataset matching seed.sql
const defaultDoctors: Doctor[] = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Dr Naeem Khattak',
    specialty: 'Consultant Eye Surgeon & Retina Specialist',
    phone: '+923005901111',
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    name: 'Dr Zarin Khan',
    specialty: 'Consultant Physician & Internal Medicine',
    phone: '+923005902222',
    is_active: true,
    sort_order: 2,
  },
];

const defaultShifts: Shift[] = [
  {
    id: 's1111111-1111-1111-1111-111111111111',
    doctor_id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Default Shift',
    start_time: '08:00',
    end_time: '22:00',
    slot_duration_minutes: 9,
    days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    is_active: true,
    sort_order: 1,
  },
  {
    id: 's2222222-2222-2222-2222-222222222222',
    doctor_id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Morning Shift',
    start_time: '09:00',
    end_time: '14:00',
    slot_duration_minutes: 10,
    is_active: true,
    sort_order: 2,
  },
];

const defaultLookups: LookupItem[] = [
  // Sources
  { id: 'src-1', category: 'source', name: 'Self', color: '#3B82F6', is_active: true, sort_order: 1 },
  { id: 'src-2', category: 'source', name: 'Facebook', color: '#1877F2', is_active: true, sort_order: 2 },
  { id: 'src-3', category: 'source', name: 'TikTok', color: '#000000', is_active: true, sort_order: 3 },
  { id: 'src-4', category: 'source', name: 'Instagram', color: '#E1306C', is_active: true, sort_order: 4 },
  { id: 'src-5', category: 'source', name: 'YouTube', color: '#FF0000', is_active: true, sort_order: 5 },
  { id: 'src-6', category: 'source', name: 'Website', color: '#10B981', is_active: true, sort_order: 6 },
  { id: 'src-7', category: 'source', name: 'WhatsApp', color: '#25D366', is_active: true, sort_order: 7 },
  { id: 'src-8', category: 'source', name: 'Referral', color: '#8B5CF6', is_active: true, sort_order: 8 },
  { id: 'src-9', category: 'source', name: 'Phone call', color: '#EC4899', is_active: true, sort_order: 9 },

  // Purposes
  { id: 'purp-1', category: 'purpose', name: 'Consultation', color: '#EF4444', is_active: true, sort_order: 1 },
  { id: 'purp-2', category: 'purpose', name: 'Follow Up', color: '#3B82F6', is_active: true, sort_order: 2 },
  { id: 'purp-3', category: 'purpose', name: 'Procedure', color: '#10B981', is_active: true, sort_order: 3 },
  { id: 'purp-4', category: 'purpose', name: 'Emergency', color: '#DC2626', is_active: true, sort_order: 4 },
  { id: 'purp-5', category: 'purpose', name: 'Report Review', color: '#F59E0B', is_active: true, sort_order: 5 },

  // Called As
  { id: 'ca-1', category: 'called_as', name: 'Hospital Patient', color: '#0284C7', is_active: true, sort_order: 1 },
  { id: 'ca-2', category: 'called_as', name: 'VIP', color: '#F59E0B', is_active: true, sort_order: 2 },
  { id: 'ca-3', category: 'called_as', name: 'Staff Member', color: '#10B981', is_active: true, sort_order: 3 },
  { id: 'ca-4', category: 'called_as', name: 'Relative', color: '#8B5CF6', is_active: true, sort_order: 4 },

  // Cities
  { id: 'city-pesh', category: 'city', name: 'Peshawar', is_active: true, sort_order: 1 },
  { id: 'city-isb', category: 'city', name: 'Islamabad', is_active: true, sort_order: 2 },
  { id: 'city-rwp', category: 'city', name: 'Rawalpindi', is_active: true, sort_order: 3 },
  { id: 'city-lhr', category: 'city', name: 'Lahore', is_active: true, sort_order: 4 },
  { id: 'city-khi', category: 'city', name: 'Karachi', is_active: true, sort_order: 5 },
  { id: 'city-mardan', category: 'city', name: 'Mardan', is_active: true, sort_order: 6 },
  { id: 'city-swat', category: 'city', name: 'Swat', is_active: true, sort_order: 7 },
  { id: 'city-kohat', category: 'city', name: 'Kohat', is_active: true, sort_order: 8 },
  { id: 'city-other', category: 'city', name: 'Other', is_active: true, sort_order: 9 },

  // Areas
  { id: 'area-1', category: 'area', parent_id: 'city-pesh', name: 'Hayatabad Phase 1', is_active: true, sort_order: 1 },
  { id: 'area-2', category: 'area', parent_id: 'city-pesh', name: 'Hayatabad Phase 2', is_active: true, sort_order: 2 },
  { id: 'area-3', category: 'area', parent_id: 'city-pesh', name: 'Hayatabad Phase 3', is_active: true, sort_order: 3 },
  { id: 'area-4', category: 'area', parent_id: 'city-pesh', name: 'University Town', is_active: true, sort_order: 4 },
  { id: 'area-5', category: 'area', parent_id: 'city-pesh', name: 'Saddar', is_active: true, sort_order: 5 },
  { id: 'area-6', category: 'area', parent_id: 'city-pesh', name: 'Kohat Road Peshawar', is_active: true, sort_order: 6 },
  { id: 'area-7', category: 'area', parent_id: 'city-pesh', name: 'Warsak Road', is_active: true, sort_order: 7 },
  { id: 'area-8', category: 'area', parent_id: 'city-pesh', name: 'Ring Road', is_active: true, sort_order: 8 },
];

const defaultClinicSettings: ClinicSettings = {
  name: 'Dr Naeem Eye Laser & Retina Center',
  tagline: 'Real-time schedule and patient coordination center',
  phone: '+92-91-5840000',
  address: 'Khyber Medical Centre, Dabgari Gardens, Peshawar',
  website: 'www.drnaeemcenter.com',
  emergency_phone: '+92-300-5900000',
};

// Generate 30 days of in-memory seed bookings for rich immediate experience
function generateSeedBookings(): { bookings: Booking[]; patients: Patient[] } {
  const bookings: Booking[] = [];
  const patients: Patient[] = [];
  const firstNames = ['Ubaida', 'Balbla', 'Fareed Ullah', 'Jahanzaib', 'Abdur Raheem', 'Qazi Maria', 'Rasheed', 'Saeed Khan', 'Akbar Jan', 'Hussain', 'Dr Aizaz', 'Zulfiqar', 'Kamran', 'Bushra Bibi', 'Taimoor', 'Noman'];
  const lastNames = ['Khan', 'Afridi', 'Khattak', 'Mohmand', 'Jan', 'Shah', 'Bangash', 'Shinwari'];
  const sources = ['Self', 'Facebook', 'TikTok', 'Instagram', 'YouTube', 'Website', 'WhatsApp', 'Referral', 'Phone call'];
  const purposes = ['Consultation', 'Follow Up', 'Procedure', 'Report Review'];
  const areas = ['Hayatabad Phase 1', 'Hayatabad Phase 2', 'University Town', 'Kohat Road Peshawar', 'Saddar', 'Peshawar'];

  const todayStr = getTodayDateString();
  const [ty, tm, td] = todayStr.split('-').map(Number);

  let patientCounter = 10001;

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const d = new Date(Date.UTC(ty, tm - 1, td - dayOffset));
    const dateStr = d.toISOString().split('T')[0];
    const dailyCount = dayOffset === 0 ? 63 : 25 + (dayOffset * 7) % 25;

    for (let slotIdx = 1; slotIdx <= dailyCount; slotIdx++) {
      patientCounter++;
      const slotMins = 8 * 60 + (slotIdx - 1) * 9;
      const h24 = Math.floor(slotMins / 60);
      const min = slotMins % 60;
      const slotTime = `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const slotTimeFormatted = SlotEngine.formatTime12h(slotMins);

      const resType = slotIdx % 4 === 0 ? 'Walk-in' : 'Appointment';
      const source = sources[(slotIdx * 3 + dayOffset) % sources.length];
      const purpose = purposes[(slotIdx * 2) % purposes.length];

      let status: BookingStatus = 'pending';
      if (dayOffset === 0) {
        if (slotIdx <= 27) status = 'checked_in';
        else if (slotIdx <= 30) status = 'in_process';
        else if (slotIdx % 15 === 0) status = 'absent';
        else status = 'pending';
      } else {
        if (slotIdx % 10 === 0) status = 'absent';
        else if (purpose === 'Follow Up') status = 'follow_up';
        else status = 'completed';
      }

      const pId = `p-${patientCounter}`;
      const fn = firstNames[(slotIdx + dayOffset) % firstNames.length];
      const ln = lastNames[(slotIdx * 2 + dayOffset) % lastNames.length];
      const fullPhone = `+92333${String(1000000 + slotIdx * 179 + dayOffset * 231).slice(0, 7)}`;
      const cnic = `17301${String(10000000 + slotIdx * 137 + dayOffset * 99).slice(0, 8)}`;
      const area = areas[(slotIdx + dayOffset) % areas.length];
      const age = 18 + ((slotIdx * 3 + dayOffset) % 55);

      const patient: Patient = {
        id: pId,
        patient_mrn: `MRN-${patientCounter}`,
        first_name: fn,
        last_name: ln,
        cnic,
        phone_code: '+92',
        phone_prefix: '333',
        phone_number: fullPhone.slice(5),
        full_phone: fullPhone,
        city: 'Peshawar',
        area,
        age,
      };
      patients.push(patient);

      const tokenCode = `${resType === 'Walk-in' ? 'W' : 'A'}-${String(slotIdx).padStart(3, '0')}`;

      bookings.push({
        id: `b-${dateStr}-${slotIdx}`,
        booking_date: dateStr,
        doctor_id: 'd1111111-1111-1111-1111-111111111111',
        shift_id: 's1111111-1111-1111-1111-111111111111',
        patient_id: pId,
        slot_index: slotIdx,
        slot_time: slotTime,
        slot_time_formatted: slotTimeFormatted,
        token_number: slotIdx,
        token_code: tokenCode,
        purpose,
        reservation_type: resType,
        source,
        called_as: 'Hospital Patient',
        status,
        check_in_time: status === 'checked_in' || status === 'completed' ? `${dateStr}T08:28:00+05:00` : null,
        completed_time: status === 'completed' ? `${dateStr}T09:15:00+05:00` : null,
        reprinted_count: 0,
        created_at: `${dateStr}T08:00:00+05:00`,
        updated_at: `${dateStr}T08:00:00+05:00`,
        patient,
        doctor_name: 'Dr Naeem Khattak',
        shift_name: 'Default Shift',
      });
    }
  }

  return { bookings, patients };
}

// In-Memory Global State
const seedData = generateSeedBookings();
let localBookings: Booking[] = [...seedData.bookings];
let localPatients: Patient[] = [...seedData.patients];
let localDoctors: Doctor[] = [...defaultDoctors];
let localShifts: Shift[] = [...defaultShifts];
let localLookups: LookupItem[] = [...defaultLookups];
let localWaitingList: WaitingListItem[] = [];
let localClinicSettings: ClinicSettings = { ...defaultClinicSettings };

let localUsers: UserProfile[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'admin',
    full_name: 'System Administrator',
    email: 'admin@drnaeemcenter.com',
    role: 'admin',
    status: 'active',
    must_change_password: false,
    failed_attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'operator',
    full_name: 'Lead Operator Ali',
    email: 'ali.operator@drnaeemcenter.com',
    role: 'operator',
    status: 'active',
    must_change_password: false,
    failed_attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'receptionist',
    full_name: 'Front Desk Sara',
    email: 'sara.reception@drnaeemcenter.com',
    role: 'receptionist',
    status: 'active',
    must_change_password: false,
    failed_attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let localAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    username: 'admin',
    user_role: 'admin',
    action_type: 'login',
    entity_type: 'auth',
    details_json: { ip: '127.0.0.1', message: 'Admin login success' },
    created_at: new Date().toISOString(),
  },
];

// Helper to broadcast local changes across tabs/windows
function broadcastEvent(type: string, payload: any) {
  if (syncChannel) {
    syncChannel.postMessage({ type, payload });
  }
}

export const api = {
  // --------------------------------------------------------------------------
  // DOCTORS & SHIFTS
  // --------------------------------------------------------------------------
  async getActiveDoctors(): Promise<Doctor[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });
      if (!error && data && data.length > 0) return data;
    }
    return localDoctors.filter((d) => d.is_active);
  },

  async getAllDoctors(): Promise<Doctor[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('doctors').select('*').is('deleted_at', null).order('sort_order', { ascending: true });
      if (data && data.length > 0) return data;
    }
    return [...localDoctors];
  },

  async saveDoctor(doctor: Partial<Doctor>): Promise<Doctor> {
    if (isSupabaseConfigured && supabase) {
      try {
        if (doctor.id && !doctor.id.startsWith('doc-')) {
          const { data, error } = await supabase.from('doctors').update(doctor).eq('id', doctor.id).select().single();
          if (!error && data) return data as Doctor;
        } else {
          const { id, ...payload } = doctor;
          const { data, error } = await supabase.from('doctors').insert([payload]).select().single();
          if (!error && data) return data as Doctor;
        }
      } catch (err) {
        console.warn('Supabase saveDoctor failed, falling back to local', err);
      }
    }
    if (doctor.id) {
      const idx = localDoctors.findIndex((d) => d.id === doctor.id);
      if (idx !== -1) {
        localDoctors[idx] = { ...localDoctors[idx], ...doctor } as Doctor;
        return localDoctors[idx];
      }
    }
    const newDoc: Doctor = {
      id: `doc-${Date.now()}`,
      name: doctor.name || 'New Doctor',
      specialty: doctor.specialty || 'General',
      phone: doctor.phone || '',
      is_active: doctor.is_active ?? true,
      sort_order: doctor.sort_order || localDoctors.length + 1,
    };
    localDoctors.push(newDoc);
    return newDoc;
  },

  async getShifts(doctorId: string): Promise<Shift[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('shifts')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });
      if (data && data.length > 0) return data;
    }
    return localShifts.filter((s) => s.doctor_id === doctorId && s.is_active);
  },

  async saveShift(shift: Partial<Shift>): Promise<Shift> {
    if (isSupabaseConfigured && supabase) {
      try {
        if (shift.id && !shift.id.startsWith('shift-')) {
          const { data, error } = await supabase.from('shifts').update(shift).eq('id', shift.id).select().single();
          if (!error && data) return data as Shift;
        } else {
          const { id, ...payload } = shift;
          const { data, error } = await supabase.from('shifts').insert([payload]).select().single();
          if (!error && data) return data as Shift;
        }
      } catch (err) {
        console.warn('Supabase saveShift failed, falling back to local', err);
      }
    }
    if (shift.id) {
      const idx = localShifts.findIndex((s) => s.id === shift.id);
      if (idx !== -1) {
        localShifts[idx] = { ...localShifts[idx], ...shift } as Shift;
        return localShifts[idx];
      }
    }
    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      doctor_id: shift.doctor_id || '',
      name: shift.name || 'Shift',
      start_time: shift.start_time || '08:00',
      end_time: shift.end_time || '20:00',
      slot_duration_minutes: shift.slot_duration_minutes || 9,
      is_active: shift.is_active ?? true,
      sort_order: shift.sort_order || localShifts.length + 1,
    };
    localShifts.push(newShift);
    return newShift;
  },

  // --------------------------------------------------------------------------
  // CLINIC SETTINGS
  // --------------------------------------------------------------------------
  async getClinicInfo(): Promise<ClinicSettings> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('clinic_settings').select('value_json').eq('key_name', 'clinic_info').single();
      if (data?.value_json) return data.value_json as ClinicSettings;
    }
    return localClinicSettings;
  },

  async saveClinicInfo(settings: ClinicSettings): Promise<ClinicSettings> {
    localClinicSettings = { ...settings };
    if (isSupabaseConfigured && supabase) {
      await supabase.from('clinic_settings').upsert({ key_name: 'clinic_info', value_json: settings });
    }
    return localClinicSettings;
  },

  // --------------------------------------------------------------------------
  // LOOKUP ITEMS
  // --------------------------------------------------------------------------
  async getLookupsByCategory(category: string): Promise<LookupItem[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('lookup_items')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });
      if (data && data.length > 0) return data;
    }
    return localLookups.filter((item) => item.category === category && item.is_active);
  },

  async getAllLookups(): Promise<LookupItem[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('lookup_items')
        .select('*')
        .is('deleted_at', null)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      if (!error && data && data.length > 0) return data as LookupItem[];
    }
    return [...localLookups];
  },

  async saveLookupItem(item: Partial<LookupItem>): Promise<LookupItem> {
    if (isSupabaseConfigured && supabase) {
      try {
        if (item.id && !item.id.startsWith('lookup-') && !item.id.startsWith('src-') && !item.id.startsWith('purp-') && !item.id.startsWith('ca-') && !item.id.startsWith('city-') && !item.id.startsWith('area-')) {
          const { data, error } = await supabase.from('lookup_items').update(item).eq('id', item.id).select().single();
          if (!error && data) return data as LookupItem;
        } else {
          const { id, ...payload } = item;
          const { data, error } = await supabase.from('lookup_items').insert([payload]).select().single();
          if (!error && data) return data as LookupItem;
        }
      } catch (err) {
        console.warn('Supabase saveLookupItem failed, falling back to local', err);
      }
    }
    if (item.id) {
      const idx = localLookups.findIndex((l) => l.id === item.id);
      if (idx !== -1) {
        localLookups[idx] = { ...localLookups[idx], ...item } as LookupItem;
        return localLookups[idx];
      }
    }
    const newItem: LookupItem = {
      id: `lookup-${Date.now()}`,
      category: item.category || 'source',
      name: item.name || '',
      color: item.color,
      parent_id: item.parent_id,
      is_active: item.is_active ?? true,
      sort_order: item.sort_order || localLookups.length + 1,
    };
    localLookups.push(newItem);
    return newItem;
  },

  // --------------------------------------------------------------------------
  // DAILY STAT CARDS
  // --------------------------------------------------------------------------
  async getDailyStats(date: string, doctorId: string, shiftId: string): Promise<DailyStatCardsData> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('get_daily_stat_cards', {
        p_date: date,
        p_doctor_id: doctorId,
        p_shift_id: shiftId,
      });
      if (!error && data) return data as DailyStatCardsData;
    }

    const shift = localShifts.find((s) => s.id === shiftId);
    let totalSlots = 94;
    if (shift) {
      const slots = SlotEngine.generateSlots(shift, []);
      totalSlots = slots.length;
    }

    const activeBookings = localBookings.filter(
      (b) => b.booking_date === date && b.doctor_id === doctorId && b.shift_id === shiftId && !b.deleted_at && b.status !== 'cancelled'
    );

    const totalBookings = activeBookings.length;
    const bookedSlots = totalBookings;
    const availableSlots = Math.max(0, totalSlots - bookedSlots);

    let checkInCount = 0;
    let inProcessCount = 0;
    let pendingCount = 0;
    let absentCount = 0;
    let completedCount = 0;
    let followUpCount = 0;
    let remainingFollowUpCount = 0;
    const sourcesCount: Record<string, number> = {};

    const activeSources = localLookups.filter((l) => l.category === 'source' && l.is_active);
    for (const s of activeSources) {
      sourcesCount[s.name] = 0;
    }

    for (const b of activeBookings) {
      if (b.status === 'checked_in') checkInCount++;
      else if (b.status === 'in_process') inProcessCount++;
      else if (b.status === 'pending') pendingCount++;
      else if (b.status === 'absent') absentCount++;
      else if (b.status === 'completed') completedCount++;

      if (b.status === 'follow_up' || b.purpose.toLowerCase().includes('follow')) {
        followUpCount++;
        if (b.status === 'pending') remainingFollowUpCount++;
      }

      if (b.source) {
        sourcesCount[b.source] = (sourcesCount[b.source] || 0) + 1;
      }
    }

    return {
      totalBookings,
      totalSlots,
      bookedSlots,
      bookedPercentage: totalSlots > 0 ? Number(((bookedSlots / totalSlots) * 100).toFixed(1)) : 0,
      availableSlots,
      availablePercentage: totalSlots > 0 ? Number(((availableSlots / totalSlots) * 100).toFixed(1)) : 0,
      checkInCount,
      checkInPercentage: totalBookings > 0 ? Number(((checkInCount / totalBookings) * 100).toFixed(1)) : 0,
      inProcessCount,
      inProcessPercentage: totalBookings > 0 ? Number(((inProcessCount / totalBookings) * 100).toFixed(1)) : 0,
      pendingCount,
      pendingPercentage: totalBookings > 0 ? Number(((pendingCount / totalBookings) * 100).toFixed(1)) : 0,
      absentCount,
      absentPercentage: totalBookings > 0 ? Number(((absentCount / totalBookings) * 100).toFixed(1)) : 0,
      completedCount,
      followUpCount,
      followUpPercentage: totalBookings > 0 ? Number(((followUpCount / totalBookings) * 100).toFixed(1)) : 0,
      remainingFollowUpCount,
      remainingFollowUpPercentage:
        followUpCount > 0 ? Number(((remainingFollowUpCount / followUpCount) * 100).toFixed(1)) : 100.0,
      sourcesCount,
    };
  },

  // --------------------------------------------------------------------------
  // BOOKINGS & SLOTS
  // --------------------------------------------------------------------------
  async getBookingsForShiftAndDate(date: string, doctorId: string, shiftId: string): Promise<Booking[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, patient:patients(*), doctor:doctors(name), shift:shifts(name)')
        .eq('booking_date', date)
        .eq('doctor_id', doctorId)
        .eq('shift_id', shiftId)
        .is('deleted_at', null)
        .order('slot_index', { ascending: true });
      if (!error && data) {
        return data.map((b: any) => ({
          ...b,
          doctor_name: b.doctor?.name,
          shift_name: b.shift?.name,
        }));
      }
    }

    return localBookings
      .filter((b) => b.booking_date === date && b.doctor_id === doctorId && b.shift_id === shiftId && !b.deleted_at)
      .sort((a, b) => a.slot_index - b.slot_index);
  },

  /**
   * Atomic Booking Creation: Allocates sequential daily token inside DB transaction
   */
  async createBookingAtomic(payload: {
    doctor_id: string;
    shift_id: string;
    booking_date: string;
    slot_index: number;
    slot_time: string;
    slot_time_formatted: string;
    reservation_type: 'Appointment' | 'Walk-in';
    purpose: string;
    source: string;
    called_as: string;
    first_name: string;
    last_name?: string;
    cnic?: string;
    phone_code?: string;
    phone_prefix?: string;
    phone_number?: string;
    city?: string;
    area?: string;
    address?: string;
    age?: number;
    dob?: string;
    remarks?: string;
    waiting_list_id?: string;
    created_by?: string;
    username?: string;
    existing_patient_id?: string;
  }): Promise<Booking> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('create_booking_atomic', {
        p_doctor_id: payload.doctor_id,
        p_shift_id: payload.shift_id,
        p_booking_date: payload.booking_date,
        p_slot_index: payload.slot_index,
        p_slot_time: payload.slot_time,
        p_slot_time_formatted: payload.slot_time_formatted,
        p_reservation_type: payload.reservation_type,
        p_purpose: payload.purpose,
        p_source: payload.source,
        p_called_as: payload.called_as,
        p_first_name: payload.first_name,
        p_last_name: payload.last_name || null,
        p_cnic: payload.cnic || null,
        p_phone_code: payload.phone_code || '+92',
        p_phone_prefix: payload.phone_prefix || '300',
        p_phone_number: payload.phone_number || '',
        p_city: payload.city || null,
        p_area: payload.area || null,
        p_address: payload.address || null,
        p_age: payload.age || null,
        p_dob: payload.dob || null,
        p_remarks: payload.remarks || null,
        p_waiting_list_id: payload.waiting_list_id || null,
        p_created_by: payload.created_by || null,
        p_username: payload.username || 'system',
        p_existing_patient_id: payload.existing_patient_id || null,
      });

      if (error) {
        throw new Error(error.message);
      }
      return data as Booking;
    }

    // In-Memory Atomic Implementation with race-proof verification
    // 1. Double-Booking Check
    if (payload.slot_index && payload.slot_index > 0) {
      const existing = localBookings.find(
        (b) =>
          b.doctor_id === payload.doctor_id &&
          b.shift_id === payload.shift_id &&
          b.booking_date === payload.booking_date &&
          b.slot_index === payload.slot_index &&
          !b.deleted_at &&
          b.status !== 'cancelled'
      );
      if (existing) {
        throw new Error('Slot just booked by another user');
      }
    }

    // 2. Patient Deduplication
    const fullPhone = `${payload.phone_code || '+92'}${payload.phone_prefix || ''}${payload.phone_number || ''}`;
    let patient = localPatients.find(
      (p) =>
        (payload.cnic && p.cnic === payload.cnic) ||
        (fullPhone.length >= 10 && p.full_phone === fullPhone)
    );

    if (!patient) {
      patient = {
        id: `p-${Date.now()}`,
        patient_mrn: `MRN-${Math.floor(10000 + Math.random() * 90000)}`,
        first_name: payload.first_name,
        last_name: payload.last_name,
        cnic: payload.cnic,
        phone_code: payload.phone_code || '+92',
        phone_prefix: payload.phone_prefix || '300',
        phone_number: payload.phone_number || '',
        full_phone: fullPhone,
        city: payload.city,
        area: payload.area,
        address: payload.address,
        age: payload.age,
      };
      localPatients.push(patient);
    }

    // 3. Daily Sequential Token Number Allocation (Atomic per doctor, shift, day, type)
    const existingTokens = localBookings.filter(
      (b) =>
        b.doctor_id === payload.doctor_id &&
        b.shift_id === payload.shift_id &&
        b.booking_date === payload.booking_date &&
        b.reservation_type === payload.reservation_type &&
        !b.deleted_at
    );
    const tokenNumber = existingTokens.length + 1;
    const tokenPrefix = payload.reservation_type === 'Walk-in' ? 'W' : 'A';
    const tokenCode = `${tokenPrefix}-${String(tokenNumber).padStart(3, '0')}`;

    const newBooking: Booking = {
      id: `b-${Date.now()}`,
      booking_date: payload.booking_date,
      doctor_id: payload.doctor_id,
      shift_id: payload.shift_id,
      patient_id: patient.id,
      slot_index: payload.slot_index || localBookings.length + 1,
      slot_time: payload.slot_time,
      slot_time_formatted: payload.slot_time_formatted,
      token_number: tokenNumber,
      token_code: tokenCode,
      purpose: payload.purpose,
      reservation_type: payload.reservation_type,
      source: payload.source,
      called_as: payload.called_as,
      status: 'pending',
      remarks: payload.remarks,
      created_by: payload.created_by,
      reprinted_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      patient,
      doctor_name: localDoctors.find((d) => d.id === payload.doctor_id)?.name || 'Dr Naeem Khattak',
      shift_name: localShifts.find((s) => s.id === payload.shift_id)?.name || 'Default Shift',
    };

    localBookings.push(newBooking);

    // Audit Log
    localAuditLogs.unshift({
      id: `log-${Date.now()}`,
      username: payload.username || 'user',
      action_type: 'booking_create',
      entity_type: 'booking',
      entity_id: newBooking.id,
      details_json: { token_code: tokenCode, patient: patient.first_name },
      created_at: new Date().toISOString(),
    });

    // Broadcast realtime event
    broadcastEvent('booking_created', newBooking);

    return newBooking;
  },

  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    userId: string,
    username: string,
    reason?: string
  ): Promise<Booking> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('update_booking_status', {
        p_booking_id: bookingId,
        p_status: status,
        p_user_id: userId,
        p_username: username,
        p_reason: reason || null,
      });
      if (!error && data) return data as Booking;
    }

    const booking = localBookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error('Booking not found');

    booking.status = status;
    booking.updated_at = new Date().toISOString();
    if (status === 'checked_in') booking.check_in_time = new Date().toISOString();
    if (status === 'in_process') booking.in_process_time = new Date().toISOString();
    if (status === 'completed') booking.completed_time = new Date().toISOString();
    if (status === 'absent') booking.absent_time = new Date().toISOString();

    localAuditLogs.unshift({
      id: `log-${Date.now()}`,
      username,
      action_type: 'status_change',
      entity_type: 'booking',
      entity_id: bookingId,
      details_json: { new_status: status, token: booking.token_code, reason },
      created_at: new Date().toISOString(),
    });

    broadcastEvent('booking_updated', booking);
    return { ...booking };
  },

  async reprintToken(bookingId: string, userId: string, username: string, format = '80mm'): Promise<Booking> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('reprint_token', {
        p_booking_id: bookingId,
        p_user_id: userId,
        p_username: username,
        p_format: format,
      });
      if (!error && data) return data as Booking;
    }

    const booking = localBookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error('Booking not found');

    booking.reprinted_count = (booking.reprinted_count || 0) + 1;

    localAuditLogs.unshift({
      id: `log-${Date.now()}`,
      username,
      action_type: 'token_reprint',
      entity_type: 'booking',
      entity_id: bookingId,
      details_json: { token: booking.token_code, format, count: booking.reprinted_count },
      created_at: new Date().toISOString(),
    });

    broadcastEvent('token_reprinted', booking);
    return { ...booking };
  },

  async softDeleteBooking(bookingId: string, userId: string, username: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('bookings')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', bookingId);

        if (!error) {
          await supabase.from('audit_logs').insert([{
            user_id: userId,
            username,
            action_type: 'booking_delete',
            entity_type: 'booking',
            entity_id: bookingId,
            details_json: { booking_id: bookingId },
            created_at: new Date().toISOString(),
          }]);
          broadcastEvent('booking_deleted', { id: bookingId });
          return true;
        }
      } catch (err) {
        console.warn('Supabase softDeleteBooking failed, falling back to local', err);
      }
    }

    const booking = localBookings.find((b) => b.id === bookingId);
    if (!booking) return false;

    booking.deleted_at = new Date().toISOString();

    localAuditLogs.unshift({
      id: `log-${Date.now()}`,
      username,
      action_type: 'booking_delete',
      entity_type: 'booking',
      entity_id: bookingId,
      details_json: { token: booking.token_code, patient: booking.patient?.first_name },
      created_at: new Date().toISOString(),
    });

    broadcastEvent('booking_deleted', { id: bookingId });
    return true;
  },

  // --------------------------------------------------------------------------
  // WAITING LIST
  // --------------------------------------------------------------------------
  async getWaitingList(date: string, doctorId: string, shiftId: string): Promise<WaitingListItem[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('waiting_list')
          .select('*')
          .eq('booking_date', date)
          .eq('doctor_id', doctorId)
          .eq('shift_id', shiftId)
          .eq('status', 'waiting')
          .is('deleted_at', null)
          .order('priority', { ascending: true })
          .order('created_at', { ascending: true });
        if (!error && data) return data as WaitingListItem[];
      } catch (err) {
        console.warn('Supabase getWaitingList failed, falling back to local', err);
      }
    }
    return localWaitingList.filter(
      (w) => w.booking_date === date && w.doctor_id === doctorId && w.shift_id === shiftId && w.status === 'waiting'
    );
  },

  async addWaitingListItem(item: Omit<WaitingListItem, 'id' | 'created_at' | 'status'>): Promise<WaitingListItem> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('waiting_list')
          .insert([{
            ...item,
            status: 'waiting',
          }])
          .select()
          .single();
        if (!error && data) {
          broadcastEvent('waiting_list_added', data);
          return data as WaitingListItem;
        }
      } catch (err) {
        console.warn('Supabase addWaitingListItem failed, falling back to local', err);
      }
    }
    const newItem: WaitingListItem = {
      ...item,
      id: `wait-${Date.now()}`,
      status: 'waiting',
      created_at: new Date().toISOString(),
    };
    localWaitingList.push(newItem);
    broadcastEvent('waiting_list_added', newItem);
    return newItem;
  },

  // --------------------------------------------------------------------------
  // PATIENT SEARCH & HISTORY
  // --------------------------------------------------------------------------
  async searchPatients(query: string): Promise<Patient[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,full_phone.ilike.%${q}%,cnic.ilike.%${q}%,patient_mrn.ilike.%${q}%`)
          .is('deleted_at', null)
          .limit(10);
        if (!error && data && data.length > 0) return data as Patient[];
      } catch (err) {
        console.warn('Supabase searchPatients failed, falling back to local', err);
      }
    }
    return localPatients
      .filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) ||
          (p.last_name && p.last_name.toLowerCase().includes(q)) ||
          p.full_phone.includes(q) ||
          (p.cnic && p.cnic.includes(q)) ||
          p.patient_mrn.toLowerCase().includes(q)
      )
      .slice(0, 10);
  },

  async getPatientHistory(patientId: string): Promise<Booking[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, doctor:doctors(name), shift:shifts(name)')
          .eq('patient_id', patientId)
          .is('deleted_at', null)
          .order('booking_date', { ascending: false });
        if (!error && data) {
          return data.map((b: any) => ({
            ...b,
            doctor_name: b.doctor?.name,
            shift_name: b.shift?.name,
          }));
        }
      } catch (err) {
        console.warn('Supabase getPatientHistory failed, falling back to local', err);
      }
    }
    return localBookings
      .filter((b) => b.patient_id === patientId && !b.deleted_at)
      .sort((a, b) => b.booking_date.localeCompare(a.booking_date));
  },

  // --------------------------------------------------------------------------
  // USER MANAGEMENT (Admin Only)
  // --------------------------------------------------------------------------
  async getUsers(): Promise<UserProfile[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: true });
        if (!error && data && data.length > 0) return data as UserProfile[];
      } catch (err) {
        console.warn('Supabase getUsers failed, falling back to local', err);
      }
    }
    return [...localUsers.filter((u) => !u.deleted_at)];
  },

  async saveUser(user: Partial<UserProfile>): Promise<UserProfile> {
    if (isSupabaseConfigured && supabase) {
      try {
        if (user.id && !user.id.startsWith('u-')) {
          const { data, error } = await supabase
            .from('user_profiles')
            .update(user)
            .eq('id', user.id)
            .select()
            .single();
          if (!error && data) return data as UserProfile;
        } else {
          const { id, ...payload } = user;
          const { data, error } = await supabase
            .from('user_profiles')
            .insert([payload])
            .select()
            .single();
          if (!error && data) return data as UserProfile;
        }
      } catch (err) {
        console.warn('Supabase saveUser failed, falling back to local', err);
      }
    }

    if (user.id) {
      const idx = localUsers.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        // Enforce rule: Last active admin cannot be demoted or disabled
        const existing = localUsers[idx];
        if (existing.role === 'admin' && (user.role !== 'admin' || user.status === 'disabled')) {
          const activeAdmins = localUsers.filter((u) => u.role === 'admin' && u.status === 'active' && !u.deleted_at);
          if (activeAdmins.length <= 1) {
            throw new Error('The last active Administrator cannot be demoted or disabled.');
          }
        }
        localUsers[idx] = { ...localUsers[idx], ...user, updated_at: new Date().toISOString() } as UserProfile;
        return localUsers[idx];
      }
    }

    const newUser: UserProfile = {
      id: `u-${Date.now()}`,
      username: user.username || '',
      full_name: user.full_name || '',
      email: user.email,
      role: user.role || 'operator',
      status: user.status || 'active',
      must_change_password: true,
      failed_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localUsers.push(newUser);
    return newUser;
  },

  // --------------------------------------------------------------------------
  // AUDIT LOG
  // --------------------------------------------------------------------------
  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (!error && data && data.length > 0) return data as AuditLog[];
      } catch (err) {
        console.warn('Supabase getAuditLogs failed, falling back to local', err);
      }
    }
    return localAuditLogs.slice(0, limit);
  },

  // --------------------------------------------------------------------------
  // USER AUTHENTICATION & SECURITY
  // --------------------------------------------------------------------------
  async authenticateUser(
    usernameOrEmail: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('login_user', {
          p_username_or_email: usernameOrEmail,
          p_password: password,
        });
        if (!error && data) {
          if (data.success) {
            return { success: true, user: data.user as UserProfile };
          }
          return { success: false, error: data.error || 'Authentication failed' };
        }
      } catch (err) {
        console.warn('Supabase login_user RPC not available or failed, falling back to local auth:', err);
      }
    }

    // Local authentication fallback
    const matched = localUsers.find(
      (u) =>
        (u.username.toLowerCase() === usernameOrEmail.toLowerCase().trim() ||
          (u.email && u.email.toLowerCase() === usernameOrEmail.toLowerCase().trim())) &&
        !u.deleted_at
    );

    if (!matched) {
      return { success: false, error: 'Invalid username or password' };
    }

    if (matched.status === 'disabled') {
      return { success: false, error: 'This user account is currently disabled by Administrator.' };
    }

    const defaultPasswords: Record<string, string> = {
      admin: 'admin123',
      operator: 'operator123',
      receptionist: 'reception123',
    };

    if (defaultPasswords[matched.username] && defaultPasswords[matched.username] !== password) {
      return { success: false, error: 'Invalid username or password' };
    }

    return { success: true, user: matched };
  },

  async changeUserPassword(userId: string, newPassword: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('change_user_password', {
          p_user_id: userId,
          p_new_password: newPassword,
        });
        if (!error && data?.success) return true;
      } catch (err) {
        console.warn('Supabase change_user_password failed, using local update:', err);
      }
    }
    const user = localUsers.find((u) => u.id === userId);
    if (user) {
      user.must_change_password = false;
      return true;
    }
    return true;
  },

  // --------------------------------------------------------------------------
  // ALL 8 REPORTS (Database-side aggregation with instant filters)
  // --------------------------------------------------------------------------
  async getReportOverview(startDate: string, endDate: string, doctorId?: string, source?: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_overview', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_doctor_id: doctorId || null,
        p_source: source || null,
      });
      if (data) return data;
    }

    const filtered = localBookings.filter(
      (b) =>
        b.booking_date >= startDate &&
        b.booking_date <= endDate &&
        (!doctorId || b.doctor_id === doctorId) &&
        (!source || b.source === source) &&
        !b.deleted_at &&
        b.status !== 'cancelled'
    );

    const total = filtered.length;
    const checkedIn = filtered.filter((b) => b.status === 'checked_in').length;
    const completed = filtered.filter((b) => b.status === 'completed').length;
    const absent = filtered.filter((b) => b.status === 'absent').length;

    const dailyMap = new Map<string, { bookings: number; checked_in: number; absent: number }>();
    for (const b of filtered) {
      if (!dailyMap.has(b.booking_date)) {
        dailyMap.set(b.booking_date, { bookings: 0, checked_in: 0, absent: 0 });
      }
      const item = dailyMap.get(b.booking_date)!;
      item.bookings++;
      if (b.status === 'checked_in' || b.status === 'completed') item.checked_in++;
      if (b.status === 'absent') item.absent++;
    }

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, val]) => ({ date, ...val }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalBookings: total,
      checkedIn,
      completed,
      absent,
      absentRate: total > 0 ? Number(((absent / total) * 100).toFixed(1)) : 0,
      avgPerDay: Number((total / Math.max(1, dailyTrend.length || 1)).toFixed(1)),
      dailyTrend,
    };
  },

  async getReportBookingsBySource(startDate: string, endDate: string, doctorId?: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_bookings_by_source', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_doctor_id: doctorId || null,
      });
      if (data) return data;
    }

    const filtered = localBookings.filter(
      (b) =>
        b.booking_date >= startDate &&
        b.booking_date <= endDate &&
        (!doctorId || b.doctor_id === doctorId) &&
        !b.deleted_at &&
        b.status !== 'cancelled'
    );

    const total = filtered.length;
    const sourceMap = new Map<string, { count: number; checked_in: number; completed: number; absent: number }>();

    for (const b of filtered) {
      const s = b.source || 'Other';
      if (!sourceMap.has(s)) {
        sourceMap.set(s, { count: 0, checked_in: 0, completed: 0, absent: 0 });
      }
      const st = sourceMap.get(s)!;
      st.count++;
      if (b.status === 'checked_in') st.checked_in++;
      if (b.status === 'completed') st.completed++;
      if (b.status === 'absent') st.absent++;
    }

    const sources = Array.from(sourceMap.entries())
      .map(([source, val]) => ({
        source,
        ...val,
        percentage: total > 0 ? Number(((val.count / total) * 100).toFixed(1)) : 0,
        conversion_rate:
          val.count > 0 ? Number((((val.checked_in + val.completed) / val.count) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return { totalBookings: total, sources };
  },

  async getReportTrends(startDate: string, endDate: string, doctorId?: string, groupBy = 'day'): Promise<any[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_booking_trends', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_doctor_id: doctorId || null,
        p_group_by: groupBy,
      });
      if (data) return data;
    }

    const filtered = localBookings.filter(
      (b) =>
        b.booking_date >= startDate &&
        b.booking_date <= endDate &&
        (!doctorId || b.doctor_id === doctorId) &&
        !b.deleted_at &&
        b.status !== 'cancelled'
    );

    const map = new Map<string, any>();
    for (const b of filtered) {
      const period = b.booking_date;
      if (!map.has(period)) {
        map.set(period, {
          period,
          total_bookings: 0,
          appointments: 0,
          walk_ins: 0,
          attended: 0,
          absent: 0,
        });
      }
      const row = map.get(period)!;
      row.total_bookings++;
      if (b.reservation_type === 'Appointment') row.appointments++;
      if (b.reservation_type === 'Walk-in') row.walk_ins++;
      if (b.status === 'checked_in' || b.status === 'completed') row.attended++;
      if (b.status === 'absent') row.absent++;
    }

    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  },

  async getReportPeakHours(startDate: string, endDate: string, doctorId?: string): Promise<any> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.rpc('report_peak_hours', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_doctor_id: doctorId || null,
      });
      if (data) return data;
    }

    const filtered = localBookings.filter(
      (b) =>
        b.booking_date >= startDate &&
        b.booking_date <= endDate &&
        (!doctorId || b.doctor_id === doctorId) &&
        !b.deleted_at &&
        b.status !== 'cancelled'
    );

    const hourMap = new Map<number, number>();
    for (let h = 8; h <= 21; h++) hourMap.set(h, 0);

    const dayMap = new Map<string, number>();
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach((d) => dayMap.set(d, 0));

    for (const b of filtered) {
      if (b.slot_time) {
        const h = parseInt(b.slot_time.split(':')[0], 10);
        if (!isNaN(h) && hourMap.has(h)) {
          hourMap.set(h, hourMap.get(h)! + 1);
        }
      }
      const dObj = new Date(`${b.booking_date}T12:00:00+05:00`);
      const dName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
      if (dayMap.has(dName)) {
        dayMap.set(dName, dayMap.get(dName)! + 1);
      }
    }

    const hourlyDistribution = Array.from(hourMap.entries()).map(([hour_num, bookings_count]) => ({
      hour_num,
      hour_label: SlotEngine.formatTime12h(hour_num * 60),
      bookings_count,
    }));

    const weekdayDistribution = Array.from(dayMap.entries()).map(([weekday_name, bookings_count]) => ({
      weekday_name,
      bookings_count,
    }));

    return { hourlyDistribution, weekdayDistribution };
  },

  async getReportUserPerformance(startDate: string, endDate: string): Promise<any[]> {
    return localUsers.map((u) => {
      const userBookings = localBookings.filter(
        (b) => b.booking_date >= startDate && b.booking_date <= endDate && b.created_by === u.id && !b.deleted_at
      );
      return {
        user_id: u.id,
        username: u.username,
        full_name: u.full_name,
        role: u.role,
        bookings_created: userBookings.length,
        appointments_created: userBookings.filter((b) => b.reservation_type === 'Appointment').length,
        walkins_created: userBookings.filter((b) => b.reservation_type === 'Walk-in').length,
        attended_count: userBookings.filter((b) => b.status === 'checked_in' || b.status === 'completed').length,
        absent_count: userBookings.filter((b) => b.status === 'absent').length,
      };
    });
  },

  async getReportDoctorShift(startDate: string, endDate: string): Promise<any[]> {
    return localShifts.map((s) => {
      const doc = localDoctors.find((d) => d.id === s.doctor_id);
      const shiftBookings = localBookings.filter(
        (b) => b.booking_date >= startDate && b.booking_date <= endDate && b.shift_id === s.id && !b.deleted_at
      );
      return {
        doctor_id: s.doctor_id,
        doctor_name: doc?.name || 'Doctor',
        shift_id: s.id,
        shift_name: s.name,
        slot_duration_minutes: s.slot_duration_minutes,
        total_booked: shiftBookings.length,
        appointments_count: shiftBookings.filter((b) => b.reservation_type === 'Appointment').length,
        walkins_count: shiftBookings.filter((b) => b.reservation_type === 'Walk-in').length,
        completed_count: shiftBookings.filter((b) => b.status === 'completed' || b.status === 'checked_in').length,
        absent_count: shiftBookings.filter((b) => b.status === 'absent').length,
      };
    });
  },

  async getReportTokens(startDate: string, endDate: string, doctorId?: string): Promise<any> {
    const filtered = localBookings.filter(
      (b) =>
        b.booking_date >= startDate &&
        b.booking_date <= endDate &&
        (!doctorId || b.doctor_id === doctorId) &&
        !b.deleted_at
    );

    const totalIssued = filtered.length;
    const appointments = filtered.filter((b) => b.reservation_type === 'Appointment').length;
    const walkins = filtered.filter((b) => b.reservation_type === 'Walk-in').length;
    const reprints = filtered.reduce((acc, b) => acc + (b.reprinted_count || 0), 0);
    const cancelled = filtered.filter((b) => b.status === 'cancelled').length;

    const dailyMap = new Map<string, any>();
    for (const b of filtered) {
      if (!dailyMap.has(b.booking_date)) {
        dailyMap.set(b.booking_date, {
          date: b.booking_date,
          total_tokens: 0,
          appointment_tokens: 0,
          walkin_tokens: 0,
          reprint_count: 0,
          cancelled_tokens: 0,
        });
      }
      const row = dailyMap.get(b.booking_date)!;
      row.total_tokens++;
      if (b.reservation_type === 'Appointment') row.appointment_tokens++;
      if (b.reservation_type === 'Walk-in') row.walkin_tokens++;
      row.reprint_count += b.reprinted_count || 0;
      if (b.status === 'cancelled') row.cancelled_tokens++;
    }

    return {
      totalTokensIssued: totalIssued,
      appointmentTokens: appointments,
      walkinTokens: walkins,
      totalReprints: reprints,
      cancelledTokens: cancelled,
      dailyTokens: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  },

  async getReportAbsentAndFollowup(
    startDate: string,
    endDate: string,
    doctorId?: string,
    filterType: 'all' | 'absent' | 'follow_up' = 'all'
  ): Promise<any[]> {
    return localBookings
      .filter((b) => {
        if (b.booking_date < startDate || b.booking_date > endDate) return false;
        if (doctorId && b.doctor_id !== doctorId) return false;
        if (b.deleted_at) return false;
        if (filterType === 'absent') return b.status === 'absent';
        if (filterType === 'follow_up') return b.status === 'follow_up' || b.purpose.toLowerCase().includes('follow');
        return b.status === 'absent' || b.status === 'follow_up' || b.purpose.toLowerCase().includes('follow');
      })
      .map((b) => ({
        booking_id: b.id,
        booking_date: b.booking_date,
        token_code: b.token_code,
        slot_time_formatted: b.slot_time_formatted,
        status: b.status,
        purpose: b.purpose,
        source: b.source,
        remarks: b.remarks,
        patient_id: b.patient_id,
        patient_mrn: b.patient?.patient_mrn || 'MRN-00000',
        first_name: b.patient?.first_name || 'Patient',
        last_name: b.patient?.last_name || '',
        full_phone: b.patient?.full_phone || '',
        city: b.patient?.city || '',
        area: b.patient?.area || '',
        doctor_name: b.doctor_name || 'Dr Naeem Khattak',
      }))
      .sort((a, b) => b.booking_date.localeCompare(a.booking_date));
  },

  // --------------------------------------------------------------------------
  // REALTIME SUBSCRIPTION
  // --------------------------------------------------------------------------
  subscribeToRealtime(
    onBookingChange: (payload: { event: string; record: any }) => void,
    onStatusChange?: (status: 'connected' | 'reconnecting' | 'disconnected') => void
  ): () => void {
    let unsubscribeSupabase = () => {};

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('pbr_realtime_feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
          onBookingChange({ event: payload.eventType === 'INSERT' ? 'booking_created' : payload.eventType === 'UPDATE' ? 'booking_updated' : 'booking_deleted', record: payload.new || payload.old });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiting_list' }, (payload) => {
          onBookingChange({ event: 'waiting_list_change', record: payload.new || payload.old });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, (payload) => {
          onBookingChange({ event: 'patient_change', record: payload.new || payload.old });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') onStatusChange?.('connected');
          else if (status === 'CLOSED') onStatusChange?.('disconnected');
          else onStatusChange?.('reconnecting');
        });

      unsubscribeSupabase = () => {
        supabase?.removeChannel(channel);
      };
    } else {
      onStatusChange?.('connected');
    }

    // Cross-tab BroadcastChannel listener
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data?.type && event.data?.payload) {
        onBookingChange({ event: event.data.type, record: event.data.payload });
      }
    };

    if (syncChannel) {
      syncChannel.addEventListener('message', handleBroadcast);
    }

    return () => {
      unsubscribeSupabase();
      if (syncChannel) {
        syncChannel.removeEventListener('message', handleBroadcast);
      }
    };
  },
};
