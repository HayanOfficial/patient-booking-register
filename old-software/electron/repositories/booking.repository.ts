import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { Booking, BookingStatus, ReservationType, Patient } from '../../src/types';

export class BookingRepository extends BaseRepository<Booking> {
  constructor() {
    super('bookings');
  }

  public getBookingsForShiftAndDate(
    date: string,
    doctorId: string,
    shiftId: string,
    includeDeleted: boolean = false
  ): Booking[] {
    const sql = `
      SELECT 
        b.*,
        p.id as p_id, p.patient_mrn as p_patient_mrn, p.first_name as p_first_name, p.last_name as p_last_name,
        p.cnic as p_cnic, p.phone_code as p_phone_code, p.phone_prefix as p_phone_prefix, p.phone_number as p_phone_number,
        p.full_phone as p_full_phone, p.gender as p_gender, p.age as p_age, p.dob as p_dob,
        p.city as p_city, p.area as p_area, p.address as p_address,
        d.name as doctor_name,
        s.name as shift_name
      FROM bookings b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN shifts s ON b.shift_id = s.id
      WHERE b.booking_date = ? AND b.doctor_id = ? AND b.shift_id = ?
        ${includeDeleted ? '' : "AND (b.deleted_at IS NULL OR b.deleted_at = '')"}
      ORDER BY b.slot_index ASC
    `;

    const rows = this.dbWrapper.all<any>(sql, [date, doctorId, shiftId]);
    return rows.map((r) => this.mapJoinedBooking(r));
  }

  public findActiveSlotBooking(
    date: string,
    doctorId: string,
    shiftId: string,
    slotIndex: number,
    excludeBookingId?: string
  ): Booking | null {
    let sql = `
      SELECT * FROM bookings 
      WHERE booking_date = ? AND doctor_id = ? AND shift_id = ? AND slot_index = ?
        AND (deleted_at IS NULL OR deleted_at = '')
    `;
    const params: any[] = [date, doctorId, shiftId, slotIndex];
    if (excludeBookingId) {
      sql += ` AND id != ?`;
      params.push(excludeBookingId);
    }
    return this.dbWrapper.get<Booking>(sql, params);
  }

  public getNextTokenNumber(date: string, doctorId: string, shiftId: string): number {
    const sql = `
      SELECT MAX(token_number) as max_token
      FROM bookings
      WHERE booking_date = ? AND doctor_id = ? AND shift_id = ?
    `;
    const row = this.dbWrapper.get<{ max_token: number | null }>(sql, [date, doctorId, shiftId]);
    return (row?.max_token || 0) + 1;
  }

  public create(booking: {
    booking_date: string;
    doctor_id: string;
    shift_id: string;
    patient_id: string;
    slot_index: number;
    slot_time: string;
    slot_time_formatted: string;
    token_number: number;
    token_code: string;
    purpose: string;
    reservation_type?: ReservationType;
    source?: string;
    called_as?: string;
    status?: BookingStatus;
    remarks?: string;
    created_by_user_id: string;
  }): Booking {
    const id = uuidv4();
    const now = new Date().toISOString();
    const reservationType = booking.reservation_type || 'Appointment';
    const source = booking.source || 'Self';
    const calledAs = booking.called_as || 'Hospital Patient';
    const status = booking.status || 'pending';

    this.dbWrapper.run(
      `INSERT INTO bookings (
        id, booking_date, doctor_id, shift_id, patient_id, slot_index, slot_time, slot_time_formatted,
        token_number, token_code, purpose, reservation_type, source, called_as, status,
        remarks, created_by_user_id, created_at, updated_at, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        booking.booking_date,
        booking.doctor_id,
        booking.shift_id,
        booking.patient_id,
        booking.slot_index,
        booking.slot_time,
        booking.slot_time_formatted,
        booking.token_number,
        booking.token_code,
        booking.purpose,
        reservationType,
        source,
        calledAs,
        status,
        booking.remarks || null,
        booking.created_by_user_id,
        now,
        now,
        this.deviceId,
      ]
    );

    const created = this.getBookingWithDetails(id)!;
    this.recordChangeLog('INSERT', id, created);
    return created;
  }

  public updateBooking(id: string, updates: Partial<Booking>): Booking | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    const allowedKeys: (keyof Booking)[] = [
      'slot_index',
      'slot_time',
      'slot_time_formatted',
      'purpose',
      'reservation_type',
      'source',
      'called_as',
      'status',
      'check_in_time',
      'in_process_time',
      'completed_time',
      'remarks',
    ];

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }

    if (fields.length === 0) return this.getBookingWithDetails(id);

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    this.dbWrapper.run(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = this.getBookingWithDetails(id)!;
    this.recordChangeLog('UPDATE', id, updated);
    return updated;
  }

  public getBookingWithDetails(id: string): Booking | null {
    const sql = `
      SELECT 
        b.*,
        p.id as p_id, p.patient_mrn as p_patient_mrn, p.first_name as p_first_name, p.last_name as p_last_name,
        p.cnic as p_cnic, p.phone_code as p_phone_code, p.phone_prefix as p_phone_prefix, p.phone_number as p_phone_number,
        p.full_phone as p_full_phone, p.gender as p_gender, p.age as p_age, p.dob as p_dob,
        p.city as p_city, p.area as p_area, p.address as p_address,
        d.name as doctor_name,
        s.name as shift_name
      FROM bookings b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN shifts s ON b.shift_id = s.id
      WHERE b.id = ?
    `;
    const row = this.dbWrapper.get<any>(sql, [id]);
    return row ? this.mapJoinedBooking(row) : null;
  }

  public searchBookings(query: string, limit: number = 50): Booking[] {
    const term = `%${query.trim()}%`;
    const sql = `
      SELECT 
        b.*,
        p.id as p_id, p.patient_mrn as p_patient_mrn, p.first_name as p_first_name, p.last_name as p_last_name,
        p.cnic as p_cnic, p.phone_code as p_phone_code, p.phone_prefix as p_phone_prefix, p.phone_number as p_phone_number,
        p.full_phone as p_full_phone, p.gender as p_gender, p.age as p_age, p.dob as p_dob,
        p.city as p_city, p.area as p_area, p.address as p_address,
        d.name as doctor_name,
        s.name as shift_name
      FROM bookings b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN shifts s ON b.shift_id = s.id
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
        AND (
          p.first_name LIKE ? OR p.last_name LIKE ? OR (p.first_name || ' ' || COALESCE(p.last_name, '')) LIKE ?
          OR p.full_phone LIKE ? OR p.cnic LIKE ? OR b.token_code LIKE ?
        )
      ORDER BY b.booking_date DESC, b.slot_time DESC
      LIMIT ?
    `;
    const rows = this.dbWrapper.all<any>(sql, [term, term, term, term, term, term, limit]);
    return rows.map((r) => this.mapJoinedBooking(r));
  }

  private mapJoinedBooking(row: any): Booking {
    const patient: Patient = {
      id: row.p_id || row.patient_id,
      patient_mrn: row.p_patient_mrn || '',
      first_name: row.p_first_name || '',
      last_name: row.p_last_name || undefined,
      cnic: row.p_cnic || undefined,
      phone_code: row.p_phone_code || '+92',
      phone_prefix: row.p_phone_prefix || '300',
      phone_number: row.p_phone_number || '',
      full_phone: row.p_full_phone || '',
      gender: row.p_gender || undefined,
      age: row.p_age || undefined,
      dob: row.p_dob || undefined,
      city: row.p_city || undefined,
      area: row.p_area || undefined,
      address: row.p_address || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      device_id: row.device_id,
    };

    return {
      id: row.id,
      booking_date: row.booking_date,
      doctor_id: row.doctor_id,
      shift_id: row.shift_id,
      patient_id: row.patient_id,
      slot_index: Number(row.slot_index),
      slot_time: row.slot_time,
      slot_time_formatted: row.slot_time_formatted,
      token_number: Number(row.token_number),
      token_code: row.token_code,
      purpose: row.purpose,
      reservation_type: row.reservation_type,
      source: row.source,
      called_as: row.called_as,
      status: row.status,
      check_in_time: row.check_in_time,
      in_process_time: row.in_process_time,
      completed_time: row.completed_time,
      remarks: row.remarks,
      created_by_user_id: row.created_by_user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      device_id: row.device_id,
      patient,
      doctor_name: row.doctor_name,
      shift_name: row.shift_name,
    };
  }
}
