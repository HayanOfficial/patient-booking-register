// ==============================================================================
// PATIENT BOOKING REGISTER (HIMS FRONT-DESK)
// Core Domain Types & Data Contracts
// ==============================================================================

export type UserRole = 'admin' | 'operator' | 'receptionist';

export type UserStatus = 'active' | 'disabled';

export type PermissionKey =
  | 'users.manage'
  | 'settings.manage'
  | 'reports.view'
  | 'reports.export'
  | 'bookings.create'
  | 'bookings.edit'
  | 'bookings.delete'
  | 'bookings.checkin'
  | 'bookings.status_update'
  | 'tokens.print'
  | 'patients.search'
  | 'patients.create'
  | 'waiting_list.manage'
  | 'audit.view'
  | 'analytics.daily_cards';

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  must_change_password: boolean;
  failed_attempts: number;
  lockout_until?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface Shift {
  id: string;
  doctor_id: string;
  name: string;
  start_time: string; // "08:00"
  end_time: string;   // "22:00"
  slot_duration_minutes: number;
  days_of_week?: string[];
  is_active: boolean;
  sort_order: number;
}

export type LookupCategory = 'source' | 'purpose' | 'called_as' | 'city' | 'area';

export interface LookupItem {
  id: string;
  category: LookupCategory;
  name: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
  is_active: boolean;
  sort_order: number;
}

export interface Patient {
  id: string;
  patient_mrn: string;
  first_name: string;
  last_name?: string;
  cnic?: string;
  phone_code: string;
  phone_prefix: string;
  phone_number: string;
  full_phone: string;
  gender?: 'Male' | 'Female' | 'Other';
  age?: number;
  dob?: string;
  city?: string;
  area?: string;
  address?: string;
  created_at?: string;
}

export type ReservationType = 'Appointment' | 'Walk-in';

export type BookingStatus =
  | 'pending'
  | 'checked_in'
  | 'in_process'
  | 'completed'
  | 'absent'
  | 'follow_up'
  | 'cancelled'
  | 'rescheduled';

export interface Booking {
  id: string;
  booking_date: string; // YYYY-MM-DD
  doctor_id: string;
  shift_id: string;
  patient_id: string;
  slot_index: number;
  slot_time: string; // "08:00"
  slot_time_formatted: string; // "8:00 a.m."
  token_number: number;
  token_code: string; // "A-001" or "W-001"
  purpose: string;
  reservation_type: ReservationType;
  source: string;
  called_as: string;
  status: BookingStatus;
  check_in_time?: string | null;
  in_process_time?: string | null;
  completed_time?: string | null;
  absent_time?: string | null;
  remarks?: string | null;
  created_by?: string;
  reprinted_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Joined fields for UI convenience
  patient?: Patient;
  doctor_name?: string;
  shift_name?: string;
}

export interface SlotItem {
  slot_index: number;
  slot_time: string; // "08:00"
  slot_time_formatted: string; // "8:00 a.m."
  is_booked: boolean;
  booking: Booking | null;
}

export interface DailyStatCardsData {
  totalBookings: number;
  totalSlots: number;
  bookedSlots: number;
  bookedPercentage: number;
  availableSlots: number;
  availablePercentage: number;
  checkInCount: number;
  checkInPercentage: number;
  inProcessCount: number;
  inProcessPercentage: number;
  pendingCount: number;
  pendingPercentage: number;
  absentCount: number;
  absentPercentage: number;
  completedCount: number;
  followUpCount: number;
  followUpPercentage: number;
  remainingFollowUpCount: number;
  remainingFollowUpPercentage: number;
  sourcesCount: Record<string, number>;
}

export interface WaitingListItem {
  id: string;
  booking_date: string;
  doctor_id: string;
  shift_id: string;
  patient_id?: string;
  patient_name: string;
  phone: string;
  cnic?: string;
  city?: string;
  purpose: string;
  source: string;
  called_as: string;
  priority: number;
  status: 'waiting' | 'converted' | 'cancelled';
  converted_booking_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  username: string;
  user_role?: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  details_json: any;
  created_at: string;
}

export interface ClinicSettings {
  name: string;
  tagline: string;
  phone: string;
  address: string;
  website?: string;
  emergency_phone?: string;
}

export type StatCardFilter =
  | 'all'
  | 'booked'
  | 'available'
  | 'checked_in'
  | 'in_process'
  | 'pending'
  | 'absent'
  | 'follow_up'
  | 'remaining_fu'
  | string; // for source names like 'source:Facebook'
