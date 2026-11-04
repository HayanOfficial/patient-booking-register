import { describe, it, expect } from 'vitest';
import { SlotEngine } from '../electron/services/slot-engine';
import { Shift, Booking } from '../src/types';

describe('SlotEngine', () => {
  const sampleShift: Shift = {
    id: 'shift-1',
    doctor_id: 'doc-1',
    name: 'Default Shift',
    start_time: '08:00',
    end_time: '18:00',
    slot_duration_minutes: 9,
    is_active: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    device_id: 'DEV1',
  };

  it('should correctly convert HH:mm to minutes from midnight and back', () => {
    expect(SlotEngine.timeToMinutes('08:00')).toBe(480);
    expect(SlotEngine.timeToMinutes('17:18')).toBe(1038);
    expect(SlotEngine.minutesToTime(480)).toBe('08:00');
    expect(SlotEngine.minutesToTime(1038)).toBe('17:18');
  });

  it('should format 12-hour timestamps with a.m./p.m.', () => {
    expect(SlotEngine.formatTime12h('08:00')).toBe('8:00 a.m.');
    expect(SlotEngine.formatTime12h('08:09')).toBe('8:09 a.m.');
    expect(SlotEngine.formatTime12h('12:00')).toBe('12:00 p.m.');
    expect(SlotEngine.formatTime12h('17:18')).toBe('5:18 p.m.');
    expect(SlotEngine.formatTime12h('17:45')).toBe('5:45 p.m.');
  });

  it('should generate exact sequence of slots for a shift', () => {
    const slots = SlotEngine.generateSlots(sampleShift, []);
    // From 08:00 to 18:00 is 600 minutes / 9 minutes per slot = 66.66 => 67 slots
    expect(slots.length).toBe(67);
    expect(slots[0].slot_index).toBe(1);
    expect(slots[0].slot_time_formatted).toBe('8:00 a.m.');
    expect(slots[1].slot_index).toBe(2);
    expect(slots[1].slot_time_formatted).toBe('8:09 a.m.');
    expect(slots[0].is_booked).toBe(false);
  });

  it('should overlay booked slots correctly onto generated slots', () => {
    const sampleBooking: Booking = {
      id: 'book-1',
      booking_date: '2026-09-29',
      doctor_id: 'doc-1',
      shift_id: 'shift-1',
      patient_id: 'pat-1',
      slot_index: 2,
      slot_time: '08:09',
      slot_time_formatted: '8:09 a.m.',
      token_number: 1,
      token_code: 'A-01',
      purpose: 'Consultation',
      reservation_type: 'Appointment',
      source: 'Facebook',
      called_as: 'Hospital Patient',
      status: 'pending',
      created_by_user_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: 'DEV1',
    };

    const slots = SlotEngine.generateSlots(sampleShift, [sampleBooking]);
    expect(slots[0].is_booked).toBe(false);
    expect(slots[1].is_booked).toBe(true);
    expect(slots[1].booking?.token_code).toBe('A-01');
    expect(slots[1].booking?.source).toBe('Facebook');
  });
});
