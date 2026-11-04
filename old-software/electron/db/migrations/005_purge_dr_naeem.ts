export const migration005 = `
-- Migration 005: Purge Dr Naeem Khattak and guarantee Dr Zarin as primary consultant
INSERT OR IGNORE INTO doctors (id, name, specialty, phone, is_active, sort_order, created_at, updated_at, device_id)
VALUES ('doc-001', 'Dr Zarin', 'Consultant Physician & General Medicine', '+923001234567', 1, 1, datetime('now'), datetime('now'), 'DEV1');

INSERT OR IGNORE INTO shifts (id, doctor_id, name, start_time, end_time, slot_duration_minutes, is_active, sort_order, created_at, updated_at, device_id)
VALUES ('shift-001', 'doc-001', 'Full Day Shift (Till 10 PM)', '08:00', '22:00', 9, 1, 1, datetime('now'), datetime('now'), 'DEV1');

-- Reassign any bookings referencing Naeem / Khattak to Dr Zarin
UPDATE bookings
SET doctor_id = 'doc-001', shift_id = 'shift-001'
WHERE doctor_id IN (SELECT id FROM doctors WHERE name LIKE '%Naeem%' OR name LIKE '%Khattak%' OR name LIKE '%Khatam%');

-- Reassign any waiting list items referencing Naeem / Khattak to Dr Zarin
UPDATE waiting_list
SET doctor_id = 'doc-001', shift_id = 'shift-001'
WHERE doctor_id IN (SELECT id FROM doctors WHERE name LIKE '%Naeem%' OR name LIKE '%Khattak%' OR name LIKE '%Khatam%');

-- Soft-delete any shifts belonging to Naeem/Khattak
UPDATE shifts
SET deleted_at = datetime('now'), is_active = 0
WHERE doctor_id IN (SELECT id FROM doctors WHERE name LIKE '%Naeem%' OR name LIKE '%Khattak%' OR name LIKE '%Khatam%')
   OR name LIKE '%Naeem%' OR name LIKE '%Khattak%';

-- Soft-delete any doctors with name containing Naeem/Khattak/Khatam
UPDATE doctors
SET deleted_at = datetime('now'), is_active = 0
WHERE name LIKE '%Naeem%' OR name LIKE '%Khattak%' OR name LIKE '%Khatam%';

-- Ensure Dr Zarin is active and non-deleted
UPDATE doctors
SET is_active = 1, deleted_at = NULL
WHERE id = 'doc-001' OR name = 'Dr Zarin';

UPDATE shifts
SET is_active = 1, deleted_at = NULL, end_time = '22:00'
WHERE doctor_id = 'doc-001';
`;
