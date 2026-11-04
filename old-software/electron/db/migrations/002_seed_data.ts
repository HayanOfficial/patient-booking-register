import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function getSeedDataSql(): Promise<string> {
  const now = new Date().toISOString();
  const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
  const receptionistPasswordHash = bcrypt.hashSync('reception123', 10);

  // Admin user ID & Receptionist user ID
  const adminId = 'u-admin-0001';
  const receptionistId = 'u-rec-0001';

  // Doctor & Shift ID
  const doctorId = 'doc-0001';
  const shiftId = 'shift-0001';

  return `
-- Insert Default Admin & Receptionist
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role, status, must_change_password, failed_attempts, created_at, updated_at, device_id)
VALUES 
  ('${adminId}', 'admin', '${defaultPasswordHash}', 'Administrator', 'admin', 'active', 0, 0, '${now}', '${now}', 'DEV1'),
  ('${receptionistId}', 'receptionist', '${receptionistPasswordHash}', 'Front Desk Receptionist', 'receptionist', 'active', 0, 0, '${now}', '${now}', 'DEV1');

-- Permissions for Roles
-- Admin has all permissions
INSERT OR IGNORE INTO roles_permissions (id, role_name, permission_key, created_at, updated_at, device_id)
VALUES
  ('${uuidv4()}', 'admin', 'bookings.view', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'bookings.create', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'bookings.edit', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'bookings.delete', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'bookings.checkin', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'bookings.status_update', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'tokens.print', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'patients.search', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'patients.create', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'waiting_list.manage', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'analytics.daily_cards', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'analytics.full_reports', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'settings.manage', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'users.manage', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'audit.view', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'admin', 'backup.manage', '${now}', '${now}', 'DEV1');

-- Receptionist permissions (Front-desk only)
INSERT OR IGNORE INTO roles_permissions (id, role_name, permission_key, created_at, updated_at, device_id)
VALUES
  ('${uuidv4()}', 'receptionist', 'bookings.view', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'bookings.create', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'bookings.edit', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'bookings.checkin', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'bookings.status_update', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'tokens.print', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'patients.search', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'patients.create', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'waiting_list.manage', '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'receptionist', 'analytics.daily_cards', '${now}', '${now}', 'DEV1');

-- Default Doctor
INSERT OR IGNORE INTO doctors (id, name, specialty, phone, is_active, sort_order, created_at, updated_at, device_id)
VALUES ('${doctorId}', 'Dr Zarin', 'Consultant Physician & General Medicine', '+923001234567', 1, 1, '${now}', '${now}', 'DEV1');

-- Default Shift (8:00 AM to 10:00 PM, 9 min intervals = 94 slots configured)
INSERT OR IGNORE INTO shifts (id, doctor_id, name, start_time, end_time, slot_duration_minutes, is_active, sort_order, created_at, updated_at, device_id)
VALUES ('${shiftId}', '${doctorId}', 'Full Day Shift (Till 10 PM)', '08:00', '22:00', 9, 1, 1, '${now}', '${now}', 'DEV1');

-- System Settings
INSERT OR IGNORE INTO system_settings (id, key_name, value_json, created_at, updated_at, device_id)
VALUES
  ('${uuidv4()}', 'clinic_info', '${JSON.stringify({
    name: 'Dr Zarin Medical Center',
    tagline: 'Real-time schedule and patient coordination center',
    phone: '+92-91-5840000',
    address: 'Khyber Medical Centre, Peshawar',
    device_id: 'DEV1',
  }).replace(/'/g, "''")}', '${now}', '${now}', 'DEV1'),

  ('${uuidv4()}', 'security_config', '${JSON.stringify({
    idle_timeout_minutes: 15,
    max_failed_attempts: 5,
    lockout_minutes: 5,
    recovery_key: 'RECOVER-PBR-7849-AK92-X901',
  }).replace(/'/g, "''")}', '${now}', '${now}', 'DEV1'),

  ('${uuidv4()}', 'token_config', '${JSON.stringify({
    appointment_prefix: 'A',
    walkin_prefix: 'W',
    include_device_prefix: false,
    device_prefix: 'DEV1',
  }).replace(/'/g, "''")}', '${now}', '${now}', 'DEV1');

-- Lookup Items: Sources
INSERT OR IGNORE INTO lookup_items (id, category, name, color, icon, is_active, sort_order, created_at, updated_at, device_id)
VALUES
  ('${uuidv4()}', 'source', 'Self', '#3B82F6', 'user', 1, 1, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'source', 'Facebook', '#1877F2', 'facebook', 1, 2, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'source', 'TikTok', '#000000', 'video', 1, 3, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'source', 'Instagram', '#E1306C', 'camera', 1, 4, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'source', 'YouTube', '#FF0000', 'youtube', 1, 5, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'source', 'Website', '#10B981', 'globe', 1, 6, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'source', 'WhatsApp', '#25D366', 'message-circle', 1, 7, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'source', 'Referral', '#8B5CF6', 'users', 1, 8, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'source', 'Phone call', '#EC4899', 'phone', 1, 9, '${now}', '${now}', 'DEV1');

-- Lookup Items: Purposes
INSERT OR IGNORE INTO lookup_items (id, category, name, color, icon, is_active, sort_order, created_at, updated_at, device_id)
VALUES
  ('${uuidv4()}', 'purpose', 'Consultation', '#EF4444', 'target', 1, 1, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'purpose', 'Follow Up', '#3B82F6', 'refresh-cw', 1, 2, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'purpose', 'Procedure', '#10B981', 'activity', 1, 3, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'purpose', 'Emergency', '#DC2626', 'alert-circle', 1, 4, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'purpose', 'Report Review', '#F59E0B', 'file-text', 1, 5, '${now}', '${now}', 'DEV1');

-- Lookup Items: Called As
INSERT OR IGNORE INTO lookup_items (id, category, name, color, icon, is_active, sort_order, created_at, updated_at, device_id)
VALUES
  ('${uuidv4()}', 'called_as', 'Hospital Patient', '#0284C7', 'user-check', 1, 1, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'called_as', 'VIP', '#F59E0B', 'star', 1, 2, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'called_as', 'Staff Member', '#10B981', 'award', 1, 3, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'called_as', 'Relative', '#8B5CF6', 'heart', 1, 4, '${now}', '${now}', 'DEV1');

-- Lookup Items: Cities & Areas
INSERT OR IGNORE INTO lookup_items (id, category, name, is_active, sort_order, created_at, updated_at, device_id)
VALUES
  ('city-pesh', 'city', 'Peshawar', 1, 1, '${now}', '${now}', 'DEV1'),
  ('city-isb', 'city', 'Islamabad', 1, 2, '${now}', '${now}', 'DEV1'),
  ('city-rwp', 'city', 'Rawalpindi', 1, 3, '${now}', '${now}', 'DEV1'),
  ('city-lhr', 'city', 'Lahore', 1, 4, '${now}', '${now}', 'DEV1'),
  ('city-khi', 'city', 'Karachi', 1, 5, '${now}', '${now}', 'DEV1'),
  ('city-mardan', 'city', 'Mardan', 1, 6, '${now}', '${now}', 'DEV1'),
  ('city-swat', 'city', 'Swat', 1, 7, '${now}', '${now}', 'DEV1'),
  ('city-kohat', 'city', 'Kohat', 1, 8, '${now}', '${now}', 'DEV1'),
  ('city-nowshera', 'city', 'Nowshera', 1, 9, '${now}', '${now}', 'DEV1'),
  ('city-charsadda', 'city', 'Charsadda', 1, 10, '${now}', '${now}', 'DEV1'),
  ('city-abbottabad', 'city', 'Abbottabad', 1, 11, '${now}', '${now}', 'DEV1'),
  ('city-faisalabad', 'city', 'Faisalabad', 1, 12, '${now}', '${now}', 'DEV1'),
  ('city-multan', 'city', 'Multan', 1, 13, '${now}', '${now}', 'DEV1'),
  ('city-quetta', 'city', 'Quetta', 1, 14, '${now}', '${now}', 'DEV1'),
  ('city-other', 'city', 'Other', 1, 15, '${now}', '${now}', 'DEV1');

-- Areas for Peshawar
INSERT OR IGNORE INTO lookup_items (id, category, name, parent_id, is_active, sort_order, created_at, updated_at, device_id)
VALUES
  ('${uuidv4()}', 'area', 'Hayatabad Phase 1', 'city-pesh', 1, 1, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Hayatabad Phase 2', 'city-pesh', 1, 2, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Hayatabad Phase 3', 'city-pesh', 1, 3, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Hayatabad Phase 4', 'city-pesh', 1, 4, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Hayatabad Phase 5', 'city-pesh', 1, 5, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Hayatabad Phase 6', 'city-pesh', 1, 6, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Hayatabad Phase 7', 'city-pesh', 1, 7, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'University Town', 'city-pesh', 1, 8, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'DHA Peshawar', 'city-pesh', 1, 9, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Saddar', 'city-pesh', 1, 10, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Kohat Road Peshawar', 'city-pesh', 1, 11, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Warsak Road', 'city-pesh', 1, 12, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Ring Road', 'city-pesh', 1, 13, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Gulbahar', 'city-pesh', 1, 14, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'Dalazak Road', 'city-pesh', 1, 15, '${now}', '${now}', 'DEV1'),
  ('${uuidv4()}', 'area', 'City Centre', 'city-pesh', 1, 16, '${now}', '${now}', 'DEV1');
`;
}
