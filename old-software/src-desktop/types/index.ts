// Shared domain interfaces for Patient Booking Register

export type UserRole = 'admin' | 'receptionist' | string;
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  must_change_password: boolean;
  failed_attempts: number;
  lockout_until?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  device_id: string;
}

export interface RolePermission {
  id: string;
  role_name: string;
  permission_key: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  device_id: string;
}

export type PermissionKey =
  | 'bookings.view'
  | 'bookings.create'
  | 'bookings.edit'
  | 'bookings.delete'
  | 'bookings.checkin'
  | 'bookings.status_update'
  | 'tokens.print'
  | 'patients.search'
  | 'patients.create'
  | 'waiting_list.manage'
  | 'analytics.daily_cards'
  | 'analytics.full_reports'
  | 'settings.manage'
  | 'users.manage'
  | 'audit.view'
  | 'backup.manage';

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  device_id: string;
}

export interface Shift {
  id: string;
  doctor_id: string;
  name: string;
  start_time: string; // "08:00"
  end_time: string;   // "18:00"
  slot_duration_minutes: number; // 9
  is_active: boolean;
  days_of_week?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  device_id: string;
}

export type LookupCategory = 'source' | 'purpose' | 'called_as' | 'city' | 'area';

export interface LookupItem {
  id: string;
  category: LookupCategory;
  name: string;
  parent_id?: string | null; // e.g. area linked to city ID
  color?: string;
  icon?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  device_id: string;
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
  gender?: string;
  age?: number;
  dob?: string;
  city?: string;
  area?: string;
  address?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  device_id: string;
}

export type BookingStatus =
  | 'pending'
  | 'checked_in'
  | 'in_process'
  | 'completed'
  | 'absent'
  | 'follow_up'
  | 'cancelled'
  | 'rescheduled';

export type ReservationType = 'Appointment' | 'Walk-in';

export interface Booking {
  id: string;
  booking_date: string; // "YYYY-MM-DD"
  doctor_id: string;
  shift_id: string;
  patient_id: string;
  slot_index: number; // 1-based index in shift
  slot_time: string; // "08:00"
  slot_time_formatted: string; // "8:00 a.m."
  token_number: number; // 1, 2, ...
  token_code: string; // "A-01", "W-05", "DEV1-A-01"
  purpose: string; // "Consultation", "Follow Up"
  reservation_type: ReservationType;
  source: string; // "Self", "Facebook", "Tiktok", etc.
  called_as: string; // "Hospital Patient", "VIP"
  status: BookingStatus;
  check_in_time?: string | null; // "8:28 a.m."
  in_process_time?: string | null;
  completed_time?: string | null;
  remarks?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  device_id: string;

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
  booking?: Booking | null;
}

export interface WaitingListItem {
  id: string;
  booking_date: string;
  doctor_id: string;
  shift_id: string;
  patient_id?: string;
  patient_name: string;
  phone: string;
  purpose: string;
  source: string;
  called_as: string;
  priority: number;
  status: 'waiting' | 'converted' | 'cancelled';
  converted_booking_id?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  device_id: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  username: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  details_json: string;
  created_at: string;
  device_id: string;
}

export interface ChangeLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data_json: string;
  synced: number;
  timestamp: string;
  device_id: string;
}

export interface ClinicSettings {
  name: string;
  tagline: string;
  phone: string;
  address: string;
  logo_url?: string;
}

export interface DailyStatCardsData {
  totalBookings: number;
  bookedSlots: number;
  totalSlots: number;
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
  followUpCount: number;
  followUpPercentage: number;
  remainingFollowUpCount: number;
  remainingFollowUpPercentage: number;
  sourcesCount: Record<string, number>;
}
