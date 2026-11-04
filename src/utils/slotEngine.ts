import { Shift, Booking, SlotItem } from '../types';

export class SlotEngine {
  /**
   * Convert HH:mm to minutes from midnight
   */
  public static timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  /**
   * Convert minutes from midnight to HH:mm 24h string
   */
  public static minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /**
   * Format HH:mm or minutes to 12h display string e.g. "8:00 a.m.", "5:18 p.m."
   */
  public static formatTime12h(timeStrOrMinutes: string | number): string {
    let minutes: number;
    if (typeof timeStrOrMinutes === 'string') {
      minutes = this.timeToMinutes(timeStrOrMinutes);
    } else {
      minutes = timeStrOrMinutes;
    }

    const h24 = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h24 >= 12 ? 'p.m.' : 'a.m.';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    const mStr = m.toString().padStart(2, '0');
    return `${h12}:${mStr} ${period}`;
  }

  /**
   * Generate all time slots for a given shift and overlay booked slots
   */
  public static generateSlots(shift: Shift, bookings: Booking[]): SlotItem[] {
    const startMins = this.timeToMinutes(shift.start_time);
    const endMins = this.timeToMinutes(shift.end_time);
    const duration = shift.slot_duration_minutes > 0 ? shift.slot_duration_minutes : 9;

    const bookingBySlotIndex = new Map<number, Booking>();
    for (const b of bookings) {
      if (!b.deleted_at && b.status !== 'cancelled') {
        bookingBySlotIndex.set(b.slot_index, b);
      }
    }

    const slots: SlotItem[] = [];
    let currentMin = startMins;
    let slotIndex = 1;

    // Generate slots up to end time
    while (currentMin < endMins) {
      const slotTime = this.minutesToTime(currentMin);
      const slotTimeFormatted = this.formatTime12h(currentMin);
      const existingBooking = bookingBySlotIndex.get(slotIndex) || null;

      slots.push({
        slot_index: slotIndex,
        slot_time: slotTime,
        slot_time_formatted: slotTimeFormatted,
        is_booked: existingBooking !== null,
        booking: existingBooking,
      });

      currentMin += duration;
      slotIndex++;
    }

    // Include any overflow bookings (e.g. walk-ins assigned beyond regular slots)
    for (const [idx, b] of bookingBySlotIndex.entries()) {
      if (idx >= slotIndex) {
        slots.push({
          slot_index: idx,
          slot_time: b.slot_time,
          slot_time_formatted: b.slot_time_formatted,
          is_booked: true,
          booking: b,
        });
      }
    }

    return slots;
  }
}
