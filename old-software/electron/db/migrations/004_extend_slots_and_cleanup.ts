export const migration004 = `
-- Migration 004: Extend slots to 10:00 PM (22:00) and remove any lingering sample doctors
UPDATE shifts
SET end_time = '22:00'
WHERE end_time < '22:00';

DELETE FROM doctors
WHERE name LIKE '%Naeem%' OR name LIKE '%Khattak%' OR name LIKE '%Khatam%' OR name LIKE '%Imran%';

-- Ensure at least Dr Zarin exists if no active doctors remain
INSERT OR IGNORE INTO doctors (id, name, specialty, phone, is_active, sort_order, created_at, updated_at, device_id)
VALUES ('doc-001', 'Dr Zarin', 'Consultant Physician & General Medicine', '+923001234567', 1, 1, datetime('now'), datetime('now'), 'DEV1');

INSERT OR IGNORE INTO shifts (id, doctor_id, name, start_time, end_time, slot_duration_minutes, is_active, sort_order, created_at, updated_at, device_id)
VALUES ('shift-001', 'doc-001', 'Full Day Shift (Till 10 PM)', '08:00', '22:00', 9, 1, 1, datetime('now'), datetime('now'), 'DEV1');
`;
