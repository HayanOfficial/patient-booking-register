export const migration001 = `
-- Schema Migration 001: Initial Tables with UUIDs and Sync metadata

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'receptionist',
  status TEXT NOT NULL DEFAULT 'active',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  lockout_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1'
);

-- Roles and Permissions Table
CREATE TABLE IF NOT EXISTS roles_permissions (
  id TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1',
  UNIQUE(role_name, permission_key)
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  key_name TEXT NOT NULL UNIQUE,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1'
);

-- Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1'
);

-- Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 9,
  is_active INTEGER NOT NULL DEFAULT 1,
  days_of_week TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1',
  FOREIGN KEY(doctor_id) REFERENCES doctors(id)
);

-- Lookup Items (Sources, Purposes, Called-As, Cities, Areas)
CREATE TABLE IF NOT EXISTS lookup_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  color TEXT,
  icon TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1'
);

-- Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  patient_mrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  cnic TEXT,
  phone_code TEXT NOT NULL DEFAULT '+92',
  phone_prefix TEXT NOT NULL DEFAULT '300',
  phone_number TEXT NOT NULL,
  full_phone TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  dob TEXT,
  city TEXT,
  area TEXT,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1'
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  booking_date TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  slot_time TEXT NOT NULL,
  slot_time_formatted TEXT NOT NULL,
  token_number INTEGER NOT NULL,
  token_code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  reservation_type TEXT NOT NULL DEFAULT 'Appointment',
  source TEXT NOT NULL DEFAULT 'Self',
  called_as TEXT NOT NULL DEFAULT 'Hospital Patient',
  status TEXT NOT NULL DEFAULT 'pending',
  check_in_time TEXT,
  in_process_time TEXT,
  completed_time TEXT,
  remarks TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1',
  FOREIGN KEY(doctor_id) REFERENCES doctors(id),
  FOREIGN KEY(shift_id) REFERENCES shifts(id),
  FOREIGN KEY(patient_id) REFERENCES patients(id)
);

-- Waiting List Table
CREATE TABLE IF NOT EXISTS waiting_list (
  id TEXT PRIMARY KEY,
  booking_date TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Self',
  called_as TEXT NOT NULL DEFAULT 'Hospital Patient',
  priority INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',
  converted_booking_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL DEFAULT 'DEV1'
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT 'DEV1'
);

-- Change Log Table for Future LAN/P2P Sync
CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  data_json TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT 'DEV1'
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_bookings_date_doctor_shift ON bookings(booking_date, doctor_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_bookings_patient ON bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(full_phone);
CREATE INDEX IF NOT EXISTS idx_patients_cnic ON patients(cnic);
CREATE INDEX IF NOT EXISTS idx_lookup_category ON lookup_items(category, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_change_log_synced ON change_log(synced, timestamp);
`;
