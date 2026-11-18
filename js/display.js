// ==============================================================================
// Token Display Board Controller
// ==============================================================================
import { api } from './api.js';
import { startRealtime } from './realtime.js';
import { todayDateString } from './utils.js';

let currentDate = todayDateString();
let currentDoctor = null;
let currentShift = null;

const $ = id => document.getElementById(id);

// Live clock update
function updateClock() {
  const clockEl = $('disp-clock');
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      timeZone: 'Asia/Karachi'
    });
  }
}
setInterval(updateClock, 1000);
updateClock();

async function init() {
  try {
    const c = await api.getClinicInfo();
    if (c?.name) $('disp-clinic-name').textContent = c.name;
  } catch (err) {
    console.warn('Clinic info fetch failed:', err);
  }

  // Load first active doctor and shift
  const docs = await api.getActiveDoctors();
  if (docs.length > 0) {
    currentDoctor = docs[0];
    const shifts = await api.getShifts(currentDoctor.id);
    if (shifts.length > 0) {
      currentShift = shifts[0];
    }
  }

  if (currentDoctor && currentShift) {
    $('disp-doc-shift').textContent = `${currentDoctor.name} — ${currentShift.name}`;
  }

  await loadQueue();

  // Listen to realtime changes
  startRealtime(({ event }) => {
    if (event === 'booking_created' || event === 'booking_updated' || event === 'booking_deleted') {
      loadQueue();
    }
  }, '#realtime-indicator');
}

async function loadQueue() {
  if (!currentDoctor || !currentShift) return;
  try {
    const bookings = await api.getBookingsForShiftAndDate(currentDate, currentDoctor.id, currentShift.id);

    // Queue order = token order
    const tokenedBookings = bookings
      .filter(b => b.token_number && !b.deleted_at && b.status !== 'cancelled')
      .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));

    // Active in process
    const inProcess = tokenedBookings.find(b => b.status === 'in_process');
    if (inProcess) {
      $('calling-token').textContent = `Token #${inProcess.token_number}`;
      $('calling-name').textContent = inProcess.patient ? `${inProcess.patient.first_name} ${inProcess.patient.last_name || ''}` : 'Patient';
      $('calling-info').textContent = `Slot: ${inProcess.slot_time_formatted || inProcess.slot_time} • ${inProcess.purpose}`;
    } else {
      $('calling-token').textContent = '—';
      $('calling-name').textContent = 'Awaiting Next Patient';
      $('calling-info').textContent = 'No patient currently inside consultation';
    }

    // Checked in (next in queue by token order)
    const checkedInList = tokenedBookings.filter(b => b.status === 'checked_in');
    if (checkedInList.length > 0) {
      const nextPat = checkedInList[0];
      $('next-token').textContent = `Token #${nextPat.token_number}`;
      $('next-name').textContent = nextPat.patient ? `${nextPat.patient.first_name} ${nextPat.patient.last_name || ''}` : 'Patient';
      $('next-info').textContent = `Slot: ${nextPat.slot_time_formatted || nextPat.slot_time} • Checked in`;
    } else {
      $('next-token').textContent = '—';
      $('next-name').textContent = 'No checked-in patients';
      $('next-info').textContent = 'Waiting for arrivals';
    }

    // Waiting queue tokens (all checked-in awaiting doctor)
    const grid = $('waiting-grid');
    if (checkedInList.length === 0) {
      grid.innerHTML = '<div class="waiting-item" style="color:#64748b;">No queue</div>';
    } else {
      grid.innerHTML = checkedInList.map(b => `
        <div class="waiting-item" style="border: 2px solid #10b981; color:#10b981; min-width:90px; text-align:center;">
          <div style="font-size:1.8rem; font-weight:800;">#${b.token_number}</div>
          <div style="font-size:.7rem;margin-top:2px;color:#94a3b8;">${b.slot_time_formatted || b.slot_time}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Queue load error:', err);
  }
}

init();

