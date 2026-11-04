import { describe, it, expect, beforeAll } from 'vitest';
import { AppDatabase } from '../electron/db/database';
import { DatabaseMigrator } from '../electron/db/migrator';
import { BookingService } from '../electron/services/booking.service';
import { AuthService } from '../electron/services/auth.service';
import { PatientRepository } from '../electron/repositories/patient.repository';
import path from 'path';
import fs from 'fs';

describe('Booking Service & Double-Booking & Permissions', () => {
  let db: AppDatabase;
  let bookingService: BookingService;
  let authService: AuthService;
  let patientRepo: PatientRepository;

  beforeAll(async () => {
    const testDbPath = path.join(process.cwd(), 'local-data', 'test_db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = AppDatabase.getInstance();
    await db.initialize(testDbPath);
    await DatabaseMigrator.runMigrations(db);

    bookingService = new BookingService();
    authService = new AuthService();
    patientRepo = new PatientRepository();
  });

  it('should successfully book an open slot', () => {
    const res = bookingService.createQuickBooking(
      {
        booking_date: '2026-10-04',
        doctor_id: 'doc-0001',
        shift_id: 'shift-0001',
        slot_index: 1,
        slot_time: '08:00',
        slot_time_formatted: '8:00 a.m.',
        purpose: 'Consultation',
        reservation_type: 'Appointment',
        source: 'Self',
        called_as: 'Hospital Patient',
        first_name: 'Ubaida',
        last_name: 'Khan',
        phone_code: '+92',
        phone_prefix: '333',
        phone_number: '9619180',
        city: 'Peshawar',
        age: 20,
      },
      { id: 'u-admin-0001', username: 'admin', role: 'admin' }
    );

    expect(res.success).toBe(true);
    expect(res.booking?.token_code).toBe('A-01');
    expect(res.booking?.slot_index).toBe(1);
    expect(res.booking?.patient?.first_name).toBe('Ubaida');
  });

  it('should PREVENT double-booking the same slot on the same date/doctor/shift', () => {
    const res = bookingService.createQuickBooking(
      {
        booking_date: '2026-10-04',
        doctor_id: 'doc-0001',
        shift_id: 'shift-0001',
        slot_index: 1, // Already booked by Ubaida
        slot_time: '08:00',
        slot_time_formatted: '8:00 a.m.',
        purpose: 'Follow Up',
        reservation_type: 'Appointment',
        source: 'Facebook',
        called_as: 'Hospital Patient',
        first_name: 'Second',
        last_name: 'Patient',
        phone_code: '+92',
        phone_prefix: '300',
        phone_number: '1234567',
      },
      { id: 'u-admin-0001', username: 'admin', role: 'admin' }
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain('already booked');
  });

  it('should auto-increment sequential daily tokens (A-01, A-02)', () => {
    const res2 = bookingService.createQuickBooking(
      {
        booking_date: '2026-10-04',
        doctor_id: 'doc-0001',
        shift_id: 'shift-0001',
        slot_index: 2,
        slot_time: '08:09',
        slot_time_formatted: '8:09 a.m.',
        purpose: 'Consultation',
        reservation_type: 'Appointment',
        source: 'Facebook',
        called_as: 'Hospital Patient',
        first_name: 'Balbla',
        phone_code: '+92',
        phone_prefix: '333',
        phone_number: '5061239',
      },
      { id: 'u-admin-0001', username: 'admin', role: 'admin' }
    );

    expect(res2.success).toBe(true);
    expect(res2.booking?.token_code).toBe('A-02');
  });

  it('should assign token code corresponding to slot sequence when booking late slots (e.g. slot 20 -> A-20)', () => {
    const resLate = bookingService.createQuickBooking(
      {
        booking_date: '2026-10-04',
        doctor_id: 'doc-0001',
        shift_id: 'shift-0001',
        slot_index: 20,
        slot_time: '11:00',
        slot_time_formatted: '11:00 a.m.',
        purpose: 'Consultation',
        reservation_type: 'Appointment',
        source: 'Walk-in',
        called_as: 'Hospital Patient',
        first_name: 'Late',
        last_name: 'Patient',
        phone_code: '+92',
        phone_prefix: '300',
        phone_number: '9876543',
      },
      { id: 'u-admin-0001', username: 'admin', role: 'admin' }
    );

    expect(resLate.success).toBe(true);
    expect(resLate.booking?.slot_index).toBe(20);
    expect(resLate.booking?.token_number).toBe(20);
    expect(resLate.booking?.token_code).toBe('A-20');
  });

  it('should correctly enforce Receptionist vs Admin permissions', () => {
    // Receptionist can create bookings
    expect(authService.hasPermission('receptionist', 'bookings.create')).toBe(true);
    expect(authService.hasPermission('receptionist', 'bookings.checkin')).toBe(true);
    expect(authService.hasPermission('receptionist', 'tokens.print')).toBe(true);

    // Receptionist CANNOT manage settings or users or audit
    expect(authService.hasPermission('receptionist', 'settings.manage')).toBe(false);
    expect(authService.hasPermission('receptionist', 'users.manage')).toBe(false);
    expect(authService.hasPermission('receptionist', 'audit.view')).toBe(false);
    expect(authService.hasPermission('receptionist', 'backup.manage')).toBe(false);

    // Admin has full permissions
    expect(authService.hasPermission('admin', 'settings.manage')).toBe(true);
    expect(authService.hasPermission('admin', 'users.manage')).toBe(true);
    expect(authService.hasPermission('admin', 'audit.view')).toBe(true);
  });

  it('should block demoting or disabling the last active Admin', () => {
    const result = authService.updateUser(
      { id: 'u-admin-0001', username: 'admin', role: 'admin' },
      'u-admin-0001',
      { status: 'disabled' }
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('last active Administrator cannot be disabled');
  });
});
