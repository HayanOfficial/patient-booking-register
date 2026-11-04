import { BookingRepository } from '../repositories/booking.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { ShiftRepository } from '../repositories/doctor.repository';
import { WaitingListRepository, AuditRepository } from '../repositories/other.repositories';
import { SlotEngine } from './slot-engine';
import { TokenService } from './token.service';
import { Booking, BookingStatus, ReservationType, SlotItem, Patient } from '../../src/types';

export interface QuickBookPayload {
  booking_date: string;
  doctor_id: string;
  shift_id: string;
  slot_index: number;
  slot_time: string;
  slot_time_formatted: string;
  purpose: string;
  reservation_type: ReservationType;
  source: string;
  called_as: string;
  first_name: string;
  last_name?: string;
  cnic?: string;
  phone_code?: string;
  phone_prefix?: string;
  phone_number: string;
  city?: string;
  area?: string;
  address?: string;
  age?: number;
  dob?: string;
  remarks?: string;
  patient_id?: string; // Optional if existing patient selected
  waiting_list_id?: string; // Optional if converting from waiting list
}

export class BookingService {
  private bookingRepo: BookingRepository;
  private patientRepo: PatientRepository;
  private shiftRepo: ShiftRepository;
  private waitingRepo: WaitingListRepository;
  private auditRepo: AuditRepository;
  private tokenService: TokenService;

  constructor() {
    this.bookingRepo = new BookingRepository();
    this.patientRepo = new PatientRepository();
    this.shiftRepo = new ShiftRepository();
    this.waitingRepo = new WaitingListRepository();
    this.auditRepo = new AuditRepository();
    this.tokenService = new TokenService();
  }

  /**
   * Get all slots for date, doctor, shift with overlayed bookings
   */
  public getSlotsForShift(date: string, doctorId: string, shiftId: string): { slots: SlotItem[]; bookings: Booking[] } {
    const shift = this.shiftRepo.findById(shiftId);
    if (!shift) {
      throw new Error(`Shift not found for ID: ${shiftId}`);
    }

    const bookings = this.bookingRepo.getBookingsForShiftAndDate(date, doctorId, shiftId);
    const slots = SlotEngine.generateSlots(shift, bookings);

    return { slots, bookings };
  }

  /**
   * Create Quick Booking with double booking prevention
   */
  public createQuickBooking(
    payload: QuickBookPayload,
    actorUser: { id: string; username: string; role: string }
  ): { success: boolean; booking?: Booking; message?: string } {
    // 1. Check double booking
    const existing = this.bookingRepo.findActiveSlotBooking(
      payload.booking_date,
      payload.doctor_id,
      payload.shift_id,
      payload.slot_index
    );

    if (existing) {
      return {
        success: false,
        message: `Slot #${payload.slot_index} (${payload.slot_time_formatted}) is already booked for patient ${existing.patient?.first_name || 'Another Patient'}.`,
      };
    }

    // 2. Resolve or create patient
    let patient: Patient;
    if (payload.patient_id) {
      const found = this.patientRepo.findById(payload.patient_id);
      if (!found) {
        return { success: false, message: 'Selected patient record could not be found.' };
      }
      patient = found;
    } else {
      // Build full phone for duplicate check
      const rawNum = (payload.phone_number || '').replace(/\D/g, '');
      const phoneCode = payload.phone_code || '+92';
      const phonePrefix = (payload.phone_prefix || '').replace(/\D/g, '');
      // Construct full phone: +92 + prefix (e.g. 300) + 7 digits
      let fullPhoneForSearch = '';
      if (rawNum.length >= 7 && phonePrefix.length >= 3) {
        fullPhoneForSearch = `${phoneCode}${phonePrefix}${rawNum}`;
      }

      // Only check for duplicates when we have a proper full number (≥ 10 digits)
      const cleanedForSearch = fullPhoneForSearch.replace(/\D/g, '');
      const existingByPhone = cleanedForSearch.length >= 10
        ? this.patientRepo.findByPhone(fullPhoneForSearch)
        : null;
      const existingByCnic = payload.cnic ? this.patientRepo.findByCnic(payload.cnic) : null;

      if (existingByPhone) {
        patient = existingByPhone;
        // Update with newer details
        this.patientRepo.update(patient.id, {
          first_name: payload.first_name || patient.first_name,
          last_name: payload.last_name !== undefined ? payload.last_name : patient.last_name,
          city: payload.city || patient.city,
          area: payload.area || patient.area,
          address: payload.address || patient.address,
          age: payload.age || patient.age,
        });
      } else if (existingByCnic) {
        patient = existingByCnic;
      } else {
        // Always create a new patient record
        patient = this.patientRepo.create({
          first_name: payload.first_name,
          last_name: payload.last_name,
          cnic: payload.cnic,
          phone_code: phoneCode,
          phone_prefix: phonePrefix || payload.phone_prefix || '',
          phone_number: rawNum,
          city: payload.city,
          area: payload.area,
          address: payload.address,
          age: payload.age,
          dob: payload.dob,
        });
      }
    }

    // 3. Assign token number according to the slot sequence (Slot #1 -> Token 1 / A-01, Slot #20 -> Token 20 / A-20)
    const tokenNumber =
      payload.slot_index && Number(payload.slot_index) > 0
        ? Number(payload.slot_index)
        : this.bookingRepo.getNextTokenNumber(
            payload.booking_date,
            payload.doctor_id,
            payload.shift_id
          );
    const tokenCode = this.tokenService.formatToken(tokenNumber, payload.reservation_type);

    // 4. Save booking
    const booking = this.bookingRepo.create({
      booking_date: payload.booking_date,
      doctor_id: payload.doctor_id,
      shift_id: payload.shift_id,
      patient_id: patient.id,
      slot_index: payload.slot_index,
      slot_time: payload.slot_time,
      slot_time_formatted: payload.slot_time_formatted,
      token_number: tokenNumber,
      token_code: tokenCode,
      purpose: payload.purpose,
      reservation_type: payload.reservation_type,
      source: payload.source,
      called_as: payload.called_as,
      status: 'pending',
      remarks: payload.remarks,
      created_by_user_id: actorUser.id,
    });

    // 5. If converting from waiting list
    if (payload.waiting_list_id) {
      this.waitingRepo.convertToBooking(payload.waiting_list_id, booking.id);
    }

    // 6. Audit Log
    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'BOOKING_CREATE',
      entity_type: 'booking',
      entity_id: booking.id,
      details: {
        token: booking.token_code,
        slot: booking.slot_index,
        time: booking.slot_time_formatted,
        patient: `${patient.first_name} ${patient.last_name || ''}`.trim(),
        date: booking.booking_date,
      },
    });

    return { success: true, booking };
  }

  /**
   * Update status e.g. Checked In, In Process, Completed, Absent, Follow-Up
   */
  public updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    actorUser: { id: string; username: string; role: string }
  ): { success: boolean; booking?: Booking; message?: string } {
    const existing = this.bookingRepo.getBookingWithDetails(bookingId);
    if (!existing) {
      return { success: false, message: 'Booking not found.' };
    }

    const updates: Partial<Booking> = { status };
    const now = new Date();
    const formattedTime = SlotEngine.formatTime12h(now.getHours() * 60 + now.getMinutes());

    if (status === 'checked_in' && !existing.check_in_time) {
      updates.check_in_time = formattedTime;
    } else if (status === 'in_process') {
      updates.in_process_time = formattedTime;
    } else if (status === 'completed') {
      updates.completed_time = formattedTime;
    }

    const updated = this.bookingRepo.updateBooking(bookingId, updates);
    if (!updated) return { success: false, message: 'Failed to update booking status.' };

    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'STATUS_CHANGE',
      entity_type: 'booking',
      entity_id: bookingId,
      details: { oldStatus: existing.status, newStatus: status, checkInTime: updates.check_in_time },
    });

    return { success: true, booking: updated };
  }

  /**
   * Update booking info (edit patient info, source, purpose, etc.)
   */
  public updateBooking(
    bookingId: string,
    updates: Partial<Booking> & {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      phone_prefix?: string;
      city?: string;
      area?: string;
      address?: string;
      age?: number;
    },
    actorUser: { id: string; username: string; role: string }
  ): { success: boolean; booking?: Booking; message?: string } {
    const existing = this.bookingRepo.getBookingWithDetails(bookingId);
    if (!existing) return { success: false, message: 'Booking not found.' };

    // Update patient if provided
    if (existing.patient_id) {
      const patientUpdates: Partial<Patient> = {};
      if (updates.first_name) patientUpdates.first_name = updates.first_name;
      if (updates.last_name !== undefined) patientUpdates.last_name = updates.last_name;
      if (updates.phone_number) patientUpdates.phone_number = updates.phone_number;
      if (updates.phone_prefix) patientUpdates.phone_prefix = updates.phone_prefix;
      if (updates.city) patientUpdates.city = updates.city;
      if (updates.area) patientUpdates.area = updates.area;
      if (updates.address) patientUpdates.address = updates.address;
      if (updates.age) patientUpdates.age = updates.age;

      if (Object.keys(patientUpdates).length > 0) {
        this.patientRepo.update(existing.patient_id, patientUpdates);
      }
    }

    const updated = this.bookingRepo.updateBooking(bookingId, updates);
    if (!updated) return { success: false, message: 'Failed to update booking.' };

    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'BOOKING_UPDATE',
      entity_type: 'booking',
      entity_id: bookingId,
      details: updates,
    });

    return { success: true, booking: updated };
  }

  /**
   * Soft delete booking
   */
  public deleteBooking(
    bookingId: string,
    actorUser: { id: string; username: string; role: string }
  ): { success: boolean; message?: string } {
    const existing = this.bookingRepo.getBookingWithDetails(bookingId);
    if (!existing) return { success: false, message: 'Booking not found.' };

    const deleted = this.bookingRepo.softDelete(bookingId);
    if (!deleted) return { success: false, message: 'Failed to delete booking.' };

    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'BOOKING_DELETE',
      entity_type: 'booking',
      entity_id: bookingId,
      details: { token: existing.token_code, patient: existing.patient?.first_name },
    });

    return { success: true };
  }
}
