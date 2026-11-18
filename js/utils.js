// Shared utility functions

/** Format minutes-since-midnight to 12h string e.g. "8:00 a.m." */
export function formatTime12h(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h < 12 ? 'a.m.' : 'p.m.';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Format a 24h "HH:MM" string to 12h "h:MM a.m./p.m." */
export function formatSlotTime(slotTime) {
  if (!slotTime) return '';
  const [hStr, mStr] = slotTime.split(':');
  return formatTime12h(parseInt(hStr, 10) * 60 + parseInt(mStr || '0', 10));
}

/** Today's date string in YYYY-MM-DD (Asia/Karachi) */
export function todayDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

/** Format date as "DD-Mon-YYYY" e.g. "29-Sep-2026" */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00+05:00');
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi',
  }).replace(/ /g, '-');
}

/** Format datetime string to time only e.g. "8:28 a.m.", or full date+time */
export function formatTimestamp(ts, mode = 'time') {
  if (!ts) return '';
  const d = new Date(ts);
  if (mode === 'time') {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi',
    }).toLowerCase().replace('am', 'a.m.').replace('pm', 'p.m.');
  }
  return d.toLocaleString('en-PK', { timeZone: 'Asia/Karachi', hour12: true });
}

/** Format wait time from ISO timestamp to human "2h 15m" */
export function formatWaitTime(isoTimestamp) {
  if (!isoTimestamp) return '—';
  const diff = Math.max(0, Date.now() - new Date(isoTimestamp).getTime());
  const totalMins = Math.floor(diff / 60000);
  if (totalMins < 1) return '<1m';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Short date "29 Sep" */
export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00+05:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });
}

/** Navigate date string by offset days */
export function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00+05:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

/** Show a toast notification */
let _toastTimer;
export function showToast(message, type = 'info', duration = 3500) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast toast--${type} toast--visible`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('toast--visible'), duration);
}

/** Confirm dialog (returns boolean) */
export function confirmDialog(message) {
  return window.confirm(message);
}

/** Debounce */
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Generate slot list from shift config and existing bookings */
export function generateSlots(shift, bookings) {
  if (!shift) return [];
  const [sh, sm] = shift.start_time.split(':').map(Number);
  const [eh, em] = shift.end_time.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const dur = shift.slot_duration_minutes || 9;
  const slots = [];
  const bookingMap = {};
  for (const b of bookings) {
    if (b.slot_index) bookingMap[b.slot_index] = b;
  }
  let idx = 1;
  for (let m = startMin; m < endMin; m += dur) {
    const slotTime = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    slots.push({
      index: idx,
      slotTime,
      slotTimeFormatted: formatTime12h(m),
      booking: bookingMap[idx] || null,
    });
    idx++;
  }
  return slots;
}

/** Format phone number for display */
export function formatPhone(b) {
  if (!b) return '';
  if (b.patient?.full_phone) return b.patient.full_phone;
  return '';
}

/** Status display config */
export const STATUS_CONFIG = {
  pending:    { label: 'Pending',     cls: 'status--pending',    icon: '🕐' },
  checked_in: { label: 'Checked In',  cls: 'status--checked-in', icon: '✅' },
  in_process: { label: 'In Process',  cls: 'status--in-process', icon: '⚙️' },
  completed:  { label: 'Completed',   cls: 'status--completed',  icon: '✔️' },
  absent:     { label: 'Absent',      cls: 'status--absent',     icon: '❌' },
  follow_up:  { label: 'Follow Up',   cls: 'status--follow-up',  icon: '🔄' },
  cancelled:  { label: 'Cancelled',   cls: 'status--cancelled',  icon: '🚫' },
  rescheduled:{ label: 'Rescheduled', cls: 'status--rescheduled',icon: '📅' },
};

export function getStatusLabel(status) {
  return STATUS_CONFIG[status]?.label || status;
}

export function getStatusClass(status) {
  return STATUS_CONFIG[status]?.cls || '';
}
