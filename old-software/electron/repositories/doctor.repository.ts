import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { Doctor, Shift } from '../../src/types';

export class DoctorRepository extends BaseRepository<Doctor> {
  constructor() {
    super('doctors');
  }

  public getActiveDoctors(): Doctor[] {
    const sql = `SELECT * FROM doctors WHERE is_active = 1 AND (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, name ASC`;
    return this.dbWrapper.all<Doctor>(sql);
  }

  public override findAll(includeDeleted: boolean = false): Doctor[] {
    const sql = includeDeleted
      ? `SELECT * FROM doctors ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM doctors WHERE (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, name ASC`;
    return this.dbWrapper.all<Doctor>(sql);
  }

  public softDeleteDoctor(id: string): boolean {
    // Use raw SQL (no deleted_at filter) so we can soft-delete doctors regardless of state
    const existing = this.dbWrapper.get<Doctor>(`SELECT * FROM doctors WHERE id = ?`, [id]);
    if (!existing) return false;

    const now = new Date().toISOString();
    // Cascade soft delete associated shifts
    this.dbWrapper.run(
      `UPDATE shifts SET deleted_at = ?, is_active = 0, updated_at = ? WHERE doctor_id = ?`,
      [now, now, id]
    );
    // Soft delete doctor
    this.dbWrapper.run(
      `UPDATE doctors SET deleted_at = ?, is_active = 0, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );

    this.recordChangeLog('DELETE', id, { ...existing, deleted_at: now, updated_at: now, is_active: 0 });
    return true;
  }

  public create(doc: { name: string; specialty: string; phone?: string; avatar_url?: string; is_active?: boolean }): Doctor {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.dbWrapper.run(
      `INSERT INTO doctors (id, name, specialty, phone, avatar_url, is_active, sort_order, created_at, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [id, doc.name, doc.specialty, doc.phone || null, doc.avatar_url || null, doc.is_active !== false ? 1 : 0, now, now, this.deviceId]
    );
    const created = this.findById(id)!;
    this.recordChangeLog('INSERT', id, created);
    return created;
  }

  public update(id: string, updates: Partial<Doctor>): Doctor | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.specialty !== undefined) {
      fields.push('specialty = ?');
      params.push(updates.specialty);
    }
    if (updates.phone !== undefined) {
      fields.push('phone = ?');
      params.push(updates.phone);
    }
    if (updates.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      params.push(updates.avatar_url);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }
    if (updates.sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(updates.sort_order);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    this.dbWrapper.run(`UPDATE doctors SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = this.findById(id)!;
    this.recordChangeLog('UPDATE', id, updated);
    return updated;
  }
}

export class ShiftRepository extends BaseRepository<Shift> {
  constructor() {
    super('shifts');
  }

  public override findAll(includeDeleted: boolean = false): Shift[] {
    const sql = includeDeleted
      ? `SELECT * FROM shifts ORDER BY sort_order ASC, start_time ASC`
      : `SELECT * FROM shifts WHERE (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, start_time ASC`;
    return this.dbWrapper.all<Shift>(sql);
  }

  public getShiftsForDoctor(doctorId: string): Shift[] {
    const sql = `SELECT * FROM shifts WHERE doctor_id = ? AND is_active = 1 AND (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, start_time ASC`;
    return this.dbWrapper.all<Shift>(sql, [doctorId]);
  }

  public softDeleteShift(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    this.dbWrapper.run(
      `UPDATE shifts SET deleted_at = ?, is_active = 0, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );

    this.recordChangeLog('DELETE', id, { ...existing, deleted_at: now, updated_at: now, is_active: 0 });
    return true;
  }

  public create(shift: {
    doctor_id: string;
    name: string;
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
    days_of_week?: string;
    is_active?: boolean;
  }): Shift {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.dbWrapper.run(
      `INSERT INTO shifts (id, doctor_id, name, start_time, end_time, slot_duration_minutes, is_active, days_of_week, sort_order, created_at, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id,
        shift.doctor_id,
        shift.name,
        shift.start_time,
        shift.end_time,
        shift.slot_duration_minutes || 9,
        shift.is_active !== false ? 1 : 0,
        shift.days_of_week || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
        now,
        now,
        this.deviceId,
      ]
    );
    const created = this.findById(id)!;
    this.recordChangeLog('INSERT', id, created);
    return created;
  }

  public update(id: string, updates: Partial<Shift>): Shift | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.start_time !== undefined) {
      fields.push('start_time = ?');
      params.push(updates.start_time);
    }
    if (updates.end_time !== undefined) {
      fields.push('end_time = ?');
      params.push(updates.end_time);
    }
    if (updates.slot_duration_minutes !== undefined) {
      fields.push('slot_duration_minutes = ?');
      params.push(updates.slot_duration_minutes);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }
    if (updates.days_of_week !== undefined) {
      fields.push('days_of_week = ?');
      params.push(updates.days_of_week);
    }
    if (updates.sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(updates.sort_order);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    this.dbWrapper.run(`UPDATE shifts SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = this.findById(id)!;
    this.recordChangeLog('UPDATE', id, updated);
    return updated;
  }
}
