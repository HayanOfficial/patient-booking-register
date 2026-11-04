import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { WaitingListItem, AuditLog } from '../../src/types';

export class WaitingListRepository extends BaseRepository<WaitingListItem> {
  constructor() {
    super('waiting_list');
  }

  public getWaitingListForDate(date: string, doctorId?: string, shiftId?: string): WaitingListItem[] {
    let sql = `
      SELECT * FROM waiting_list 
      WHERE booking_date = ? AND status = 'waiting' AND (deleted_at IS NULL OR deleted_at = '')
    `;
    const params: any[] = [date];
    if (doctorId) {
      sql += ` AND doctor_id = ?`;
      params.push(doctorId);
    }
    if (shiftId) {
      sql += ` AND shift_id = ?`;
      params.push(shiftId);
    }
    sql += ` ORDER BY priority ASC, created_at ASC`;
    return this.dbWrapper.all<WaitingListItem>(sql, params);
  }

  public create(item: {
    booking_date: string;
    doctor_id: string;
    shift_id: string;
    patient_id?: string;
    patient_name: string;
    phone: string;
    purpose: string;
    source?: string;
    called_as?: string;
    priority?: number;
    notes?: string;
  }): WaitingListItem {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.dbWrapper.run(
      `INSERT INTO waiting_list (id, booking_date, doctor_id, shift_id, patient_id, patient_name, phone, purpose, source, called_as, priority, status, notes, created_at, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?)`,
      [
        id,
        item.booking_date,
        item.doctor_id,
        item.shift_id,
        item.patient_id || null,
        item.patient_name,
        item.phone,
        item.purpose,
        item.source || 'Self',
        item.called_as || 'Hospital Patient',
        item.priority || 1,
        item.notes || null,
        now,
        now,
        this.deviceId,
      ]
    );
    const created = this.findById(id)!;
    this.recordChangeLog('INSERT', id, created);
    return created;
  }

  public convertToBooking(waitingId: string, bookingId: string): boolean {
    const now = new Date().toISOString();
    this.dbWrapper.run(
      `UPDATE waiting_list SET status = 'converted', converted_booking_id = ?, updated_at = ? WHERE id = ?`,
      [bookingId, now, waitingId]
    );
    const updated = this.findById(waitingId);
    if (updated) {
      this.recordChangeLog('UPDATE', waitingId, updated);
      return true;
    }
    return false;
  }
}

export class AuditRepository extends BaseRepository<AuditLog> {
  constructor() {
    super('audit_logs');
  }

  public log(entry: {
    user_id: string;
    username: string;
    action_type: string;
    entity_type: string;
    entity_id?: string;
    details: any;
  }): AuditLog {
    const id = uuidv4();
    const now = new Date().toISOString();
    const detailsJson = JSON.stringify(entry.details);

    this.dbWrapper.run(
      `INSERT INTO audit_logs (id, user_id, username, action_type, entity_type, entity_id, details_json, created_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.user_id,
        entry.username,
        entry.action_type,
        entry.entity_type,
        entry.entity_id || null,
        detailsJson,
        now,
        this.deviceId,
      ]
    );

    return {
      id,
      user_id: entry.user_id,
      username: entry.username,
      action_type: entry.action_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      details_json: detailsJson,
      created_at: now,
      device_id: this.deviceId,
    };
  }

  public getRecentLogs(limit: number = 100): AuditLog[] {
    const sql = `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?`;
    return this.dbWrapper.all<AuditLog>(sql, [limit]);
  }
}

export class SettingRepository extends BaseRepository<{ id: string; key_name: string; value_json: string }> {
  constructor() {
    super('system_settings');
  }

  public getSetting<T>(key: string, defaultValue: T): T {
    try {
      const sql = `SELECT value_json FROM system_settings WHERE key_name = ? AND (deleted_at IS NULL OR deleted_at = '') LIMIT 1`;
      const row = this.dbWrapper.get<{ value_json: string }>(sql, [key]);
      if (!row) return defaultValue;
      return JSON.parse(row.value_json) as T;
    } catch {
      return defaultValue;
    }
  }

  public setSetting<T>(key: string, value: T): void {
    const existing = this.dbWrapper.get<{ id: string }>(
      `SELECT id FROM system_settings WHERE key_name = ?`,
      [key]
    );
    const now = new Date().toISOString();
    const valueJson = JSON.stringify(value);

    if (existing) {
      this.dbWrapper.run(
        `UPDATE system_settings SET value_json = ?, updated_at = ? WHERE id = ?`,
        [valueJson, now, existing.id]
      );
      this.recordChangeLog('UPDATE', existing.id, { key_name: key, value_json: valueJson });
    } else {
      const id = uuidv4();
      this.dbWrapper.run(
        `INSERT INTO system_settings (id, key_name, value_json, created_at, updated_at, device_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, key, valueJson, now, now, this.deviceId]
      );
      this.recordChangeLog('INSERT', id, { key_name: key, value_json: valueJson });
    }
  }
}
