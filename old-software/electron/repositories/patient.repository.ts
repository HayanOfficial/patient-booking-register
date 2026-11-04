import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { Patient, Booking } from '../../src/types';

export class PatientRepository extends BaseRepository<Patient> {
  constructor() {
    super('patients');
  }

  private generateMRN(): string {
    const row = this.dbWrapper.get<{ count: number }>(`SELECT COUNT(*) as count FROM patients`);
    const count = (row?.count || 0) + 1;
    return `MRN-${10000 + count}`;
  }

  public findByPhone(fullPhone: string): Patient | null {
    if (!fullPhone) return null;
    const cleaned = fullPhone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 5) return null;
    const sql = `SELECT * FROM patients WHERE REPLACE(REPLACE(REPLACE(full_phone, '+', ''), ' ', ''), '-', '') LIKE ? AND (deleted_at IS NULL OR deleted_at = '') LIMIT 1`;
    return this.dbWrapper.get<Patient>(sql, [`%${cleaned.slice(-7)}`]);
  }

  public findByCnic(cnic: string): Patient | null {
    const cleaned = cnic.replace(/\D/g, '');
    if (!cleaned) return null;
    const sql = `SELECT * FROM patients WHERE REPLACE(REPLACE(cnic, '-', ''), ' ', '') = ? AND (deleted_at IS NULL OR deleted_at = '') LIMIT 1`;
    return this.dbWrapper.get<Patient>(sql, [cleaned]);
  }

  public search(query: string, limit: number = 20): Patient[] {
    const term = `%${query.trim()}%`;
    const cleanNum = query.replace(/\D/g, '');
    const sql = `
      SELECT * FROM patients 
      WHERE (deleted_at IS NULL OR deleted_at = '')
        AND (
          first_name LIKE ? 
          OR last_name LIKE ? 
          OR (first_name || ' ' || COALESCE(last_name, '')) LIKE ?
          OR patient_mrn LIKE ?
          OR cnic LIKE ?
          OR full_phone LIKE ?
          OR phone_number LIKE ?
          ${cleanNum ? `OR REPLACE(REPLACE(REPLACE(full_phone, '+', ''), ' ', ''), '-', '') LIKE '%${cleanNum}%'` : ''}
        )
      ORDER BY updated_at DESC
      LIMIT ?
    `;
    return this.dbWrapper.all<Patient>(sql, [term, term, term, term, term, term, term, limit]);
  }

  public create(patient: {
    first_name: string;
    last_name?: string;
    cnic?: string;
    phone_code?: string;
    phone_prefix?: string;
    phone_number: string;
    gender?: string;
    age?: number;
    dob?: string;
    city?: string;
    area?: string;
    address?: string;
  }): Patient {
    const id = uuidv4();
    const now = new Date().toISOString();
    const mrn = this.generateMRN();
    const phoneCode = patient.phone_code || '+92';
    const phonePrefix = patient.phone_prefix || '';
    const rawNum = (patient.phone_number || '').trim();
    let fullPhone = rawNum;
    if (rawNum && !rawNum.startsWith('+')) {
      if (rawNum.startsWith('0')) {
        fullPhone = `${phoneCode}${rawNum.slice(1)}`;
      } else {
        fullPhone = `${phoneCode}${phonePrefix}${rawNum}`;
      }
    }

    this.dbWrapper.run(
      `INSERT INTO patients (id, patient_mrn, first_name, last_name, cnic, phone_code, phone_prefix, phone_number, full_phone, gender, age, dob, city, area, address, created_at, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        mrn,
        patient.first_name,
        patient.last_name || null,
        patient.cnic || null,
        phoneCode,
        phonePrefix,
        rawNum,
        fullPhone,
        patient.gender || null,
        patient.age || null,
        patient.dob || null,
        patient.city || null,
        patient.area || null,
        patient.address || null,
        now,
        now,
        this.deviceId,
      ]
    );

    const created = this.findById(id)!;
    this.recordChangeLog('INSERT', id, created);
    return created;
  }

  public update(id: string, updates: Partial<Patient>): Patient | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.first_name !== undefined) {
      fields.push('first_name = ?');
      params.push(updates.first_name);
    }
    if (updates.last_name !== undefined) {
      fields.push('last_name = ?');
      params.push(updates.last_name);
    }
    if (updates.cnic !== undefined) {
      fields.push('cnic = ?');
      params.push(updates.cnic);
    }
    if (updates.phone_code !== undefined) {
      fields.push('phone_code = ?');
      params.push(updates.phone_code);
    }
    if (updates.phone_prefix !== undefined) {
      fields.push('phone_prefix = ?');
      params.push(updates.phone_prefix);
    }
    if (updates.phone_number !== undefined) {
      fields.push('phone_number = ?');
      params.push(updates.phone_number);
    }
    if (updates.full_phone !== undefined) {
      fields.push('full_phone = ?');
      params.push(updates.full_phone);
    } else if (updates.phone_number !== undefined || updates.phone_prefix !== undefined) {
      const code = updates.phone_code || existing.phone_code;
      const prefix = updates.phone_prefix || existing.phone_prefix;
      const num = updates.phone_number || existing.phone_number;
      fields.push('full_phone = ?');
      params.push(`${code}${prefix}${num}`);
    }
    if (updates.gender !== undefined) {
      fields.push('gender = ?');
      params.push(updates.gender);
    }
    if (updates.age !== undefined) {
      fields.push('age = ?');
      params.push(updates.age);
    }
    if (updates.dob !== undefined) {
      fields.push('dob = ?');
      params.push(updates.dob);
    }
    if (updates.city !== undefined) {
      fields.push('city = ?');
      params.push(updates.city);
    }
    if (updates.area !== undefined) {
      fields.push('area = ?');
      params.push(updates.area);
    }
    if (updates.address !== undefined) {
      fields.push('address = ?');
      params.push(updates.address);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    this.dbWrapper.run(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = this.findById(id)!;
    this.recordChangeLog('UPDATE', id, updated);
    return updated;
  }

  public getPatientVisitHistory(patientId: string): Booking[] {
    const sql = `
      SELECT b.*, d.name as doctor_name, s.name as shift_name
      FROM bookings b
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN shifts s ON b.shift_id = s.id
      WHERE b.patient_id = ? AND (b.deleted_at IS NULL OR b.deleted_at = '')
      ORDER BY b.booking_date DESC, b.slot_time DESC
    `;
    return this.dbWrapper.all<Booking>(sql, [patientId]);
  }
}
