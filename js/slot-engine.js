// Slot Engine - generates time slots from shift configuration
import { formatTime12h } from './utils.js';

export class SlotEngine {
  /**
   * Generate all slots for a shift, with booking data merged in
   * @param {object} shift - { start_time, end_time, slot_duration_minutes }
   * @param {Array}  bookings - array of booking objects with slot_index
   * @returns {Array} - array of slot objects
   */
  static generateSlots(shift, bookings = []) {
    if (!shift) return [];
    const [sh, sm] = shift.start_time.split(':').map(Number);
    const [eh, em] = shift.end_time.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const dur = shift.slot_duration_minutes || 9;

    const bookingMap = {};
    for (const b of bookings) {
      if (b.slot_index && (!b.deleted_at) && b.status !== 'cancelled') {
        bookingMap[b.slot_index] = b;
      }
    }

    const slots = [];
    let idx = 1;
    for (let m = startMin; m < endMin; m += dur) {
      const slotTime = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      slots.push({
        index: idx,
        slotTime,
        slotTimeFormatted: formatTime12h(m),
        totalMinutes: m,
        booking: bookingMap[idx] || null,
      });
      idx++;
    }
    return slots;
  }

  static formatTime12h(totalMinutes) {
    return formatTime12h(totalMinutes);
  }
}
