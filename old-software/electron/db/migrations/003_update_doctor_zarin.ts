export const migration003 = `
-- Migration 003: Ensure default doctor and clinic settings use Dr Zarin
UPDATE doctors 
SET name = 'Dr Zarin', 
    specialty = 'Consultant Physician & General Medicine'
WHERE id = 'doc-001' OR name LIKE '%Imran%' OR name LIKE '%Doctor%';

UPDATE system_settings
SET value_json = '{"name":"Dr Zarin Medical Center","tagline":"Real-time schedule and patient coordination center","phone":"+92-91-5840000","address":"Khyber Medical Centre, Peshawar","device_id":"DEV1"}'
WHERE key_name = 'clinic_info';
`;
