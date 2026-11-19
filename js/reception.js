// ==============================================================================
// js/reception.js — Reception Appointment Dashboard Controller
// Role: Receptionist or Admin only
// Matches /reference/dashbord 1.png, booking.png, booking checkin.png
// ==============================================================================
import { requireAuth, logout } from './auth.js';
import { api } from './api.js';
import { startRealtime } from './realtime.js';
import { todayDateString, showToast, confirmDialog, formatTimestamp, getStatusLabel, getStatusClass } from './utils.js';

// Guard: Only Receptionist and Admin can access
const user = requireAuth(['admin', 'receptionist']);
if (!user) throw new Error('Unauthorized');

const $ = id => document.getElementById(id);

// --- State ---
let currentDate = todayDateString();
let activeDoctors = [];
let allShifts = [];
let lookups = { source: [], purpose: [] };
let selectedDoctorId = null;
let cachedWorkload = [];
let bookedPatients = [];
let checkedInPatients = [];
let waitingListItems = [];

async function init() {
  // User Header & Menu
  $('hdr-username').textContent = user.full_name || user.username;
  $('logout-btn').addEventListener('click', () => logout());
  $('user-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    $('user-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => {
    $('user-menu')?.classList.remove('open');
    $('filters-menu')?.classList.remove('open');
  });

  if (user.role !== 'admin') {
    $('nav-settings-link')?.remove();
    $('nav-users-link')?.remove();
    $('nav-reports-link')?.remove();
    $('nav-counseling-link')?.remove();
  }

  // Set today's date display
  updateDateDisplay();

  // Search and Filters
  $('reception-search-btn').addEventListener('click', performSearch);
  $('reception-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') performSearch(); });
  $('reception-search-clear').addEventListener('click', clearSearch);
  $('btn-close-search-results').addEventListener('click', clearSearch);

  $('btn-filter-pending').addEventListener('click', () => {
    $('btn-filter-pending').classList.toggle('active');
    $('btn-filter-postponed').classList.remove('active');
    filterMainDashboard('pending');
  });
  $('btn-filter-postponed').addEventListener('click', () => {
    $('btn-filter-postponed').classList.toggle('active');
    $('btn-filter-pending').classList.remove('active');
    filterMainDashboard('postponed');
  });

  $('btn-filters-dropdown').addEventListener('click', e => {
    e.stopPropagation();
    $('filters-menu').classList.toggle('open');
  });
  $('filters-menu').addEventListener('click', e => e.stopPropagation());

  // Header Navigation buttons
  $('btn-from-booking').addEventListener('click', () => openSelectDoctorModal());
  $('btn-from-waiting').addEventListener('click', () => openWaitingListModal());
  $('btn-add-waiting').addEventListener('click', () => openQuickBookModal('Waiting'));
  $('btn-modern-list').addEventListener('click', () => openModernListModal());

  // Appointment Type cards (Click & Shortcuts)
  $('btn-add-appointment').addEventListener('click', () => openQuickBookModal('Appointment'));
  $('btn-add-walkin').addEventListener('click', () => openQuickBookModal('Walk-in'));

  window.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      openQuickBookModal('Appointment');
    } else if (e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      openQuickBookModal('Walk-in');
    }
  });

  // =========================================================
  // 1. SELECT DOCTOR MODAL (Matching reference/booking.png)
  // =========================================================
  $('select-doctor-close').addEventListener('click', () => closeModal('select-doctor-modal'));
  $('select-doctor-close-btn').addEventListener('click', () => closeModal('select-doctor-modal'));

  $('btn-view-today-modal').addEventListener('click', () => {
    closeModal('select-doctor-modal');
    openDoctorCheckin(null); // All doctors
  });

  $('modal-quick-doctor-search').addEventListener('input', e => filterDoctorCards(e.target.value));
  $('modal-find-patient-btn').addEventListener('click', () => {
    const q = $('modal-find-patient-input').value.trim();
    if (q) {
      closeModal('select-doctor-modal');
      $('reception-search-input').value = q;
      performSearch();
    }
  });
  $('modal-find-patient-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('modal-find-patient-btn').click();
  });

  // =========================================================
  // 2. FROM BOOKING: CHECK-IN DESK MODAL (reference/booking checkin.png)
  // =========================================================
  $('doctor-checkin-close').addEventListener('click', () => closeModal('doctor-checkin-modal'));
  $('doctor-checkin-close-btn').addEventListener('click', () => closeModal('doctor-checkin-modal'));
  $('btn-back-to-doctors').addEventListener('click', () => {
    closeModal('doctor-checkin-modal');
    openSelectDoctorModal();
  });
  $('checkin-patient-search').addEventListener('input', e => filterCheckinTable(e.target.value));

  // =========================================================
  // 3. MODERN LIST VIEW MODAL
  // =========================================================
  $('modern-list-close').addEventListener('click', () => closeModal('modern-list-modal'));
  $('modern-list-close-btn').addEventListener('click', () => closeModal('modern-list-modal'));
  $('mlv-search-input').addEventListener('input', e => filterModernListTable(e.target.value));
  $('mlv-doctor-filter').addEventListener('change', () => loadModernListData());

  // Event delegation for Modern List View workflow buttons
  $('mlv-table').querySelector('tbody').addEventListener('click', handleModernListAction);

  // =========================================================
  // 4. WAITING LIST MODAL
  // =========================================================
  $('waiting-list-close').addEventListener('click', () => closeModal('waiting-list-modal'));
  $('waiting-list-close-btn').addEventListener('click', () => closeModal('waiting-list-modal'));
  $('wl-add-new-btn').addEventListener('click', () => {
    closeModal('waiting-list-modal');
    openQuickBookModal('Waiting');
  });

  // =========================================================
  // 5. QUICK BOOK MODAL
  // =========================================================
  $('qb-close').addEventListener('click', () => closeModal('quick-book-modal'));
  $('qb-cancel').addEventListener('click', () => closeModal('quick-book-modal'));
  $('qb-form').addEventListener('submit', handleQuickBookSubmit);
  $('qb-doc-select').addEventListener('change', onQuickBookDoctorChange);

  // Load Initial Data
  await loadLookupsAndDoctors();
  await loadWorkloadData();

  // Start Realtime (no manual refresh button needed)
  startRealtime(onRealtimeEvent, '#realtime-indicator');
  setUpdatedTimestamp();
}

function updateDateDisplay() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Karachi' };
  $('hdr-date-text').textContent = now.toLocaleDateString('en-US', options);
  $('checkin-date').textContent = currentDate;
  $('mlv-date').textContent = currentDate;
}

function setUpdatedTimestamp() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Karachi' });
  $('hdr-time-text').textContent = timeStr;
}

// --- Data Loading ---
async function loadLookupsAndDoctors() {
  activeDoctors = await api.getActiveDoctors();
  allShifts = await api.getAllShifts();
  lookups.source = await api.getLookupsByCategory('source');
  lookups.purpose = await api.getLookupsByCategory('purpose');

  // Filter dropdowns
  const docSelect = $('flt-doctor');
  docSelect.innerHTML = '<option value="">All Doctors</option>' + activeDoctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

  const mlvDocFilter = $('mlv-doctor-filter');
  mlvDocFilter.innerHTML = '<option value="">All Doctors</option>' + activeDoctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

  const srcSelect = $('flt-source');
  srcSelect.innerHTML = '<option value="">All Sources</option>' + lookups.source.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const purpSelect = $('flt-purpose');
  purpSelect.innerHTML = '<option value="">All Purposes</option>' + lookups.purpose.map(p => `<option value="${p.name}">${p.name}</option>`).join('');

  [docSelect, srcSelect, purpSelect, $('flt-type')].forEach(el => {
    el.addEventListener('change', () => applyAdvancedFilters());
  });
}

async function loadWorkloadData() {
  try {
    cachedWorkload = await api.getDoctorWorkload(currentDate);
    renderWorkloadGrid(cachedWorkload);
    renderSelectDoctorCards(cachedWorkload);
  } catch (err) {
    console.warn('Failed to load workload:', err);
  }
}

function renderWorkloadGrid(workloads) {
  const grid = $('doctor-workload-grid');
  if (!workloads || workloads.length === 0) {
    grid.innerHTML = '<div style="color:#64748b;font-size:.9rem;">No active doctors configured.</div>';
    return;
  }
  grid.innerHTML = workloads.map(w => `
    <div class="workload-card" data-doctor-id="${w.id}" style="cursor:pointer;" title="Click to open From Booking check-in desk">
      <div class="workload-top">
        <span class="workload-doctor-name">${w.name}</span>
        <span class="workload-badge-total">${w.total_bookings}</span>
      </div>
      <div class="workload-stats-row">
        <span class="workload-pill-open">⏳ Pending: ${w.pending_count}</span>
        <span class="workload-pill-done">✓ Done: ${w.checked_in_count}</span>
      </div>
      <div class="workload-time-footer">
        🕒 ${w.last_updated}
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.workload-card').forEach(card => {
    card.addEventListener('click', () => {
      openDoctorCheckin(card.dataset.doctorId);
    });
  });
}

// =========================================================
// 1. SELECT DOCTOR MODAL (Matching reference/booking.png)
// =========================================================
function renderSelectDoctorCards(workloads) {
  const container = $('modal-doctor-cards');
  if (!workloads || workloads.length === 0) {
    container.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center;">No active doctors found for today.</div>';
    return;
  }

  container.innerHTML = workloads.map(w => `
    <div class="doctor-select-card" data-doc-card-id="${w.id}" style="cursor:pointer;">
      <div class="doctor-select-card-top">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:38px;height:38px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">👨‍⚕️</div>
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:.95rem;">${w.name}</div>
          </div>
        </div>
        <span class="doctor-select-badge">${w.total_bookings}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:.8rem;">
        <span style="color:#475569;">📅 ${w.total_bookings} bookings today &nbsp;·&nbsp; ⏳ ${w.pending_count} booked</span>
        <span style="color:#2563eb;background:#eff6ff;padding:2px 10px;border-radius:9999px;font-weight:700;font-size:.75rem;">🟢 Active Now</span>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.doctor-select-card').forEach(card => {
    card.addEventListener('click', () => {
      closeModal('select-doctor-modal');
      openDoctorCheckin(card.dataset.docCardId);
    });
  });
}

function filterDoctorCards(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.doctor-select-card').forEach(card => {
    const match = card.textContent.toLowerCase().includes(q);
    card.style.display = match ? '' : 'none';
  });
}

async function openSelectDoctorModal() {
  $('select-doctor-modal').classList.add('open');
  $('modal-quick-doctor-search').value = '';
  $('modal-find-patient-input').value = '';
  filterDoctorCards('');

  try {
    await loadWorkloadData();
  } catch (err) {
    console.warn('Could not refresh workload:', err);
  }
}

// =========================================================
// 2. FROM BOOKING: CHECK-IN DESK MODAL (reference/booking checkin.png)
// Shows today's Booked patients with one Check-in button per row.
// =========================================================
async function openDoctorCheckin(doctorId = null) {
  selectedDoctorId = doctorId;
  const doc = activeDoctors.find(d => d.id === doctorId);
  $('checkin-doc-name').textContent = doc ? doc.name : 'All Doctors';
  $('checkin-date').textContent = currentDate;
  $('checkin-patient-search').value = '';

  $('doctor-checkin-modal').classList.add('open');

  const tbody = $('checkin-bookings-table').querySelector('tbody');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="7" style="text-align:center;padding:28px;">⏳ Loading booked patients...</td></tr>`;

  await loadDoctorCheckinData();
}

async function loadDoctorCheckinData() {
  try {
    // Only fetch booked / pending patients for today
    bookedPatients = await api.getReceptionBookings(selectedDoctorId, currentDate, 'pending');
    $('badge-pending-count').textContent = bookedPatients.length;
    renderCheckinTable(bookedPatients);
  } catch (err) {
    console.error('loadDoctorCheckinData error:', err);
    const tbody = $('checkin-bookings-table').querySelector('tbody');
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7" style="color:#ef4444;">Failed to load bookings: ${err.message}</td></tr>`;
  }
}

function renderCheckinTable(bookings) {
  const tbody = $('checkin-bookings-table').querySelector('tbody');

  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7" style="text-align:center;padding:36px;">
          <div style="color:#64748b;font-size:.95rem;margin-bottom:12px;">No pending bookings waiting for check-in today.</div>
          <button class="btn btn--primary btn--sm" onclick="document.getElementById('doctor-checkin-modal').classList.remove('open');document.getElementById('btn-add-walkin').click();">
            ➕ Add Walk-in Patient
          </button>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = bookings.map((b, idx) => {
    const p = b.patient || {};
    const patientName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient';
    const timeFormatted = b.slot_time_formatted || b.slot_time || '—';

    // Colored source tag
    const src = b.source || 'Direct';
    const srcColors = {
      'Self': '#4f46e5', 'Tiktok': '#000000', 'Facebook': '#1877f2',
      'Google': '#ea4335', 'WhatsApp': '#25d366', 'Direct': '#64748b'
    };
    const srcColor = srcColors[src] || '#475569';

    return `
      <tr data-booking-row="${b.id}">
        <td><strong>${b.slot_index || idx + 1}</strong></td>
        <td><span class="slot-time-pill">${timeFormatted}</span></td>
        <td>
          <div style="font-weight:700;color:#0f172a;font-size:.9rem;">${patientName}</div>
          <div style="font-size:.75rem;color:#64748b;margin-top:2px;">
            📞 ${p.full_phone || '—'}
            ${p.patient_mrn ? `&nbsp;·&nbsp; 🆔 ${p.patient_mrn}` : ''}
          </div>
        </td>
        <td>
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:.75rem;font-weight:600;background:#f1f5f9;color:${srcColor};">
            🏷️ ${src}
          </span>
        </td>
        <td>
          <span class="badge ${b.reservation_type === 'Walk-in' ? 'badge--amber' : 'badge--teal'}">
            ${b.reservation_type || 'Appointment'}
          </span>
        </td>
        <td>
          <span class="badge badge--gray">${b.purpose || 'Consultation'}</span>
        </td>
        <td style="text-align:center;">
          <button class="btn-checkin-blue" data-checkin-id="${b.id}">
            ➜ Check-in
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Check-in button: Single token sequence generated in check-in order
  tbody.querySelectorAll('[data-checkin-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bId = btn.dataset.checkinId;
      btn.disabled = true;
      btn.textContent = 'Checking in...';
      btn.style.opacity = '0.7';

      try {
        const res = await api.checkinBooking(bId);
        const tokenNum = res.token_number;
        showToast(`✅ Patient Checked In! Token #${tokenNum} assigned.`, 'success');

        // Refresh From Booking list (moves patient out of this list)
        await loadDoctorCheckinData();
        await loadWorkloadData();

        // Auto-print token slip
        const booking = bookedPatients.find(x => x.id === bId) || res.booking || {};
        printTokenSlip({ ...booking, token_number: tokenNum }, tokenNum);
      } catch (err) {
        showToast('Check-in failed: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '➜ Check-in';
        btn.style.opacity = '';
      }
    });
  });
}

function filterCheckinTable(query) {
  const q = query.toLowerCase().trim();
  const rows = document.querySelectorAll('#checkin-bookings-table tbody tr');
  rows.forEach(tr => {
    if (tr.classList.contains('empty-row')) return;
    const text = tr.textContent.toLowerCase();
    tr.style.display = text.includes(q) ? '' : 'none';
  });
}

function printTokenSlip(booking, tokenNum) {
  if (!tokenNum || tokenNum <= 0) return;
  sessionStorage.setItem('print_token_data', JSON.stringify({
    ...booking,
    token_number: tokenNum,
    token_code: String(tokenNum),
    checked_in_at: new Date().toISOString(),
  }));
  window.open('./print-token.html', '_blank', 'width=420,height=600');
}

// =========================================================
// 3. MODERN LIST VIEW MODAL
// Shows ONLY patients who are checked in today, in token order.
// Action buttons: Checked In -> In Progress -> Complete -> Checkout (+ Undo)
// =========================================================
async function openModernListModal() {
  $('modern-list-modal').classList.add('open');
  $('mlv-search-input').value = '';
  await loadModernListData();
}

async function loadModernListData() {
  const docId = $('mlv-doctor-filter').value || null;
  const tbody = $('mlv-table').querySelector('tbody');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="8" style="text-align:center;padding:28px;">⏳ Loading checked-in queue...</td></tr>`;

  try {
    checkedInPatients = await api.getReceptionBookings(docId, currentDate, 'modern_list');
    $('mlv-count-badge').textContent = `${checkedInPatients.length} Patients`;
    renderModernListTable(checkedInPatients);
  } catch (err) {
    console.error('loadModernListData error:', err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8" style="color:#ef4444;">Failed to load queue: ${err.message}</td></tr>`;
  }
}

function renderModernListTable(patients) {
  const tbody = $('mlv-table').querySelector('tbody');

  if (!patients || patients.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8" style="text-align:center;padding:36px;color:#64748b;">
          No patients checked in today yet. Click <strong>"📅 From Booking"</strong> to check in arriving patients.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = patients.map((b, idx) => {
    const p = b.patient || {};
    const patientName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient';
    const timeFormatted = b.slot_time_formatted || b.slot_time || '—';
    const tokenDisplay = b.token_number ? `#${b.token_number}` : (b.token_code || '—');

    // Workflow actions based on status
    let actionHtml = '';
    const st = b.status;

    if (st === 'checked_in') {
      actionHtml = `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
          <button class="btn btn--primary btn--sm" data-action="in_process" data-id="${b.id}">
            ▶ In Progress
          </button>
          <button class="btn btn--secondary btn--sm" data-action="undo_checkin" data-id="${b.id}" title="Undo Check-in (voids token)">
            ↩
          </button>
        </div>`;
    } else if (st === 'in_process') {
      actionHtml = `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
          <button class="btn btn--success btn--sm" data-action="completed" data-id="${b.id}" style="background:#10b981;color:#fff;">
            ✓ Complete
          </button>
          <button class="btn btn--secondary btn--sm" data-action="undo_to_checked_in" data-id="${b.id}" title="Revert to Checked In">
            ↩
          </button>
        </div>`;
    } else if (st === 'completed') {
      actionHtml = `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
          <button class="btn btn--warning btn--sm" data-action="checkout" data-id="${b.id}" style="background:#f59e0b;color:#fff;font-weight:700;">
            ➜ Checkout
          </button>
          <button class="btn btn--secondary btn--sm" data-action="undo_to_in_process" data-id="${b.id}" title="Revert to In Progress">
            ↩
          </button>
        </div>`;
    } else if (st === 'checked_out') {
      actionHtml = `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
          <span class="status-pill status--checked-out" style="font-size:.72rem;">📤 In Counseling Queue</span>
          <button class="btn btn--secondary btn--sm" data-action="undo_to_completed" data-id="${b.id}" title="Undo Checkout">
            ↩
          </button>
        </div>`;
    } else if (st === 'in_counseling') {
      actionHtml = `<span class="status-pill status--in-counseling" style="font-size:.72rem;">💬 In Counseling</span>`;
    } else if (st === 'procedure_done') {
      actionHtml = `<span class="status-pill status--procedure-done" style="font-size:.72rem;">🎯 Procedure Done</span>`;
    } else {
      actionHtml = `<span class="status-pill ${getStatusClass(st)}">${getStatusLabel(st)}</span>`;
    }

    return `
      <tr data-mlv-id="${b.id}">
        <td>
          <span style="font-size:1.05rem;font-weight:800;color:#1e40af;background:#dbeafe;padding:3px 10px;border-radius:6px;">
            ${tokenDisplay}
          </span>
        </td>
        <td>
          <div class="slot-time-pill">${timeFormatted}</div>
          ${b.check_in_time ? `<div style="font-size:.7rem;color:#059669;margin-top:2px;">In: ${formatTimestamp(b.check_in_time)}</div>` : ''}
        </td>
        <td>
          <div style="font-weight:700;color:#0f172a;">${patientName}</div>
          <div style="font-size:.75rem;color:#64748b;margin-top:2px;">
            📞 ${p.full_phone || '—'}
            ${p.patient_mrn ? `&nbsp;·&nbsp; 🆔 ${p.patient_mrn}` : ''}
          </div>
        </td>
        <td>${b.doctor_name || 'Dr Zarin Khan'}</td>
        <td>
          <span class="badge ${b.reservation_type === 'Walk-in' ? 'badge--amber' : 'badge--teal'}">
            ${b.reservation_type || 'Appointment'}
          </span>
        </td>
        <td><span class="badge badge--gray">${b.purpose || 'Consultation'}</span></td>
        <td style="text-align:center;">
          <span class="status-pill ${getStatusClass(st)}">${getStatusLabel(st)}</span>
        </td>
        <td style="text-align:center;">${actionHtml}</td>
      </tr>
    `;
  }).join('');
}

async function handleModernListAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const bookingId = btn.dataset.id;
  if (!bookingId) return;

  btn.disabled = true;

  try {
    if (action === 'in_process') {
      await api.advanceBookingStatus(bookingId, 'in_process');
      showToast('Patient consultation marked In Progress.', 'info');
    } else if (action === 'completed') {
      await api.advanceBookingStatus(bookingId, 'completed');
      showToast('Patient consultation marked Complete.', 'success');
    } else if (action === 'checkout') {
      const ok = confirmDialog('Hand over patient to Counseling? This moves the patient to the Counseling Waiting list.');
      if (!ok) {
        btn.disabled = false;
        return;
      }
      await api.advanceBookingStatus(bookingId, 'checked_out');
      showToast('✅ Patient Checked Out! Handed over to Counseling.', 'success');
    } else if (action === 'undo_checkin') {
      const ok = confirmDialog('Undo check-in? The token will be voided and not reused.');
      if (!ok) {
        btn.disabled = false;
        return;
      }
      await api.undoCheckinBooking(bookingId);
      showToast('Check-in undone. Patient returned to Booked list.', 'info');
    } else if (action === 'undo_to_checked_in') {
      await api.advanceBookingStatus(bookingId, 'checked_in');
      showToast('Status reverted to Checked In.', 'info');
    } else if (action === 'undo_to_in_process') {
      await api.advanceBookingStatus(bookingId, 'in_process');
      showToast('Status reverted to In Progress.', 'info');
    } else if (action === 'undo_to_completed') {
      await api.advanceBookingStatus(bookingId, 'completed');
      showToast('Checkout undone. Reverted to Completed.', 'info');
    }

    await loadModernListData();
    await loadWorkloadData();
  } catch (err) {
    showToast('Action failed: ' + err.message, 'error');
    btn.disabled = false;
  }
}

function filterModernListTable(query) {
  const q = query.toLowerCase().trim();
  const rows = document.querySelectorAll('#mlv-table tbody tr');
  rows.forEach(tr => {
    if (tr.classList.contains('empty-row')) return;
    const text = tr.textContent.toLowerCase();
    tr.style.display = text.includes(q) ? '' : 'none';
  });
}

// =========================================================
// 4. WAITING LIST MODAL
// =========================================================
async function openWaitingListModal() {
  $('waiting-list-modal').classList.add('open');
  await loadWaitingListData();
}

async function loadWaitingListData() {
  const tbody = $('waiting-list-table').querySelector('tbody');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;padding:24px;">⏳ Loading waiting list...</td></tr>`;

  try {
    waitingListItems = await api.getWaitingList(currentDate);
    const activeItems = waitingListItems.filter(w => w.status === 'waiting');
    $('wl-count-badge').textContent = `${activeItems.length} Waiting`;

    if (activeItems.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;padding:28px;color:#64748b;">No patients currently on waiting list for today.</td></tr>`;
      return;
    }

    tbody.innerHTML = activeItems.map((w, idx) => {
      const p = w.patient || {};
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || w.patient_name || 'Patient';
      return `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td>
            <div style="font-weight:700;">${name}</div>
            <div style="font-size:.75rem;color:#64748b;">MR: ${p.patient_mrn || '—'}</div>
          </td>
          <td>${p.full_phone || w.phone || '—'}</td>
          <td>${w.doctor_name || '—'}</td>
          <td style="font-size:.8rem;color:#64748b;">${w.notes || '—'}</td>
          <td style="text-align:center;">
            <button class="btn btn--primary btn--sm" data-convert-wl="${w.id}">
              📋 Book
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-convert-wl]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = activeItems.find(x => x.id === btn.dataset.convertWl);
        closeModal('waiting-list-modal');
        if (item) {
          openQuickBookModal('Appointment', item);
        }
      });
    });
  } catch (err) {
    console.error('loadWaitingListData error:', err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="color:#ef4444;">Failed to load waiting list.</td></tr>`;
  }
}

// =========================================================
// 5. SEARCH RESULTS
// =========================================================
async function performSearch() {
  const q = $('reception-search-input').value.trim();
  if (!q) return;

  $('reception-search-clear').classList.remove('hidden');
  const results = await api.searchReceptionBookings(q, currentDate);
  $('search-results-section').classList.remove('hidden');
  $('search-results-count').textContent = results.length;

  const tbody = $('search-results-table').querySelector('tbody');
  if (results.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No patients matching "${q}" found for today.</td></tr>`;
    return;
  }

  tbody.innerHTML = results.map(b => {
    const p = b.patient || {};
    const patientName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient';
    const isPending = b.status === 'pending';

    return `
      <tr>
        <td><strong>${b.slot_index || '—'}</strong></td>
        <td><span class="slot-time-pill">${b.slot_time_formatted || b.slot_time || '—'}</span></td>
        <td>
          <div style="font-weight:700;">${patientName}</div>
          <div style="font-size:.75rem;color:#64748b;">📞 ${p.full_phone || '—'} • 🆔 ${p.patient_mrn || '—'}</div>
        </td>
        <td>${b.doctor_name || 'Dr Zarin Khan'}</td>
        <td><span class="badge ${b.reservation_type === 'Walk-in' ? 'badge--amber' : 'badge--teal'}">${b.reservation_type}</span></td>
        <td><span class="badge badge--gray">${b.purpose}</span></td>
        <td><span class="status-pill ${getStatusClass(b.status)}">${getStatusLabel(b.status)}</span></td>
        <td>${b.token_number && b.token_number > 0 ? `<strong style="color:#1d4ed8;">Token #${b.token_number}</strong>` : '<span style="color:#94a3b8;">—</span>'}</td>
        <td>
          ${isPending
            ? `<button class="btn-checkin-blue btn-checkin-blue--sm" data-search-checkin-id="${b.id}">➜ Check-in</button>`
            : `<span style="font-size:.78rem;color:#059669;font-weight:600;">✓ Checked In</span>`
          }
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-search-checkin-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bId = btn.dataset.searchCheckinId;
      btn.disabled = true;
      btn.textContent = 'Checking in...';
      try {
        const res = await api.checkinBooking(bId);
        showToast(`✅ Patient Checked In! Token #${res.token_number} issued.`, 'success');
        await performSearch();
        await loadWorkloadData();
        printTokenSlip(res.booking, res.token_number);
      } catch (err) {
        showToast('Check-in failed: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '➜ Check-in';
      }
    });
  });
}

function clearSearch() {
  $('reception-search-input').value = '';
  $('reception-search-clear').classList.add('hidden');
  $('search-results-section').classList.add('hidden');
}

function filterMainDashboard(type) {
  $('reception-search-input').value = type === 'pending' ? 'pending' : 'postponed';
  performSearch();
}

function applyAdvancedFilters() {
  performSearch();
}

// =========================================================
// 6. QUICK BOOK MODAL (Appointment / Walk-in / Waiting)
// =========================================================
function openQuickBookModal(resType = 'Appointment', prefill = null) {
  $('qb-res-type').value = resType === 'Waiting' ? 'Appointment' : resType;
  $('qb-is-waiting').value = resType === 'Waiting' ? 'true' : 'false';
  $('qb-error').classList.add('hidden');

  $('qb-title').textContent = resType === 'Waiting'
    ? '⏳ ADD PATIENT TO WAITING LIST'
    : `📅 QUICK BOOK PATIENT (${resType.toUpperCase()})`;

  $('qb-time').textContent = resType === 'Walk-in'
    ? 'Walk-in Entry'
    : (resType === 'Waiting' ? 'Waiting List' : 'Next Available');

  // Populate doctor select
  const docSelect = $('qb-doc-select');
  docSelect.innerHTML = activeDoctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  if (prefill?.doctor_id) docSelect.value = prefill.doctor_id;
  else if (selectedDoctorId) docSelect.value = selectedDoctorId;

  onQuickBookDoctorChange();

  // Populate Purpose & Source
  $('qb-purpose').innerHTML = lookups.purpose.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  $('qb-source').innerHTML = lookups.source.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  if (prefill) {
    const p = prefill.patient || {};
    $('qb-first-name').value = p.first_name || prefill.patient_name || '';
    $('qb-last-name').value = p.last_name || '';
    $('qb-phone-prefix').value = p.phone_prefix || '300';
    $('qb-phone-num').value = p.phone_number || (p.full_phone ? p.full_phone.slice(5) : '');
    $('qb-cnic').value = p.cnic || '';
  } else {
    $('qb-form').reset();
    $('qb-phone-prefix').value = '300';
  }

  $('quick-book-modal').classList.add('open');
  setTimeout(() => $('qb-first-name').focus(), 100);
}

function onQuickBookDoctorChange() {
  const docId = $('qb-doc-select').value;
  const shifts = allShifts.filter(s => s.doctor_id === docId && s.is_active);
  const shiftSelect = $('qb-shift-select');
  shiftSelect.innerHTML = shifts.map(s => `<option value="${s.id}">${s.name} (${s.start_time} - ${s.end_time})</option>`).join('');

  const doc = activeDoctors.find(d => d.id === docId);
  const resType = $('qb-res-type').value;
  $('qb-chips').innerHTML = `
    <span class="qb-chip">👨‍⚕️ ${doc?.name || 'Doctor'}</span>
    <span class="qb-chip">🏷️ ${resType}</span>
  `;
}

async function handleQuickBookSubmit(e) {
  e.preventDefault();
  const btn = $('qb-submit');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const docId = $('qb-doc-select').value;
  const shiftId = $('qb-shift-select').value;
  const resType = $('qb-res-type').value;
  const isWaiting = $('qb-is-waiting').value === 'true';

  if (isWaiting) {
    try {
      await api.createWaitingListItem({
        doctor_id: docId,
        shift_id: shiftId,
        date: currentDate,
        patient_name: `${$('qb-first-name').value.trim()} ${$('qb-last-name').value.trim()}`.trim(),
        phone: `+92${$('qb-phone-prefix').value.trim()}${$('qb-phone-num').value.trim()}`,
        notes: $('qb-purpose').value,
        created_by: user.id
      });
      closeModal('quick-book-modal');
      showToast('✅ Added to Waiting List.', 'success');
      return;
    } catch (err) {
      $('qb-error').textContent = err.message || 'Failed to add to waiting list.';
      $('qb-error').classList.remove('hidden');
      return;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Booking';
    }
  }

  const payload = {
    doctor_id: docId,
    shift_id: shiftId,
    booking_date: currentDate,
    slot_index: null,
    slot_time: '08:00',
    slot_time_formatted: 'Next Queue',
    reservation_type: resType,
    purpose: $('qb-purpose').value,
    source: $('qb-source').value,
    called_as: 'Hospital Patient',
    first_name: $('qb-first-name').value.trim(),
    last_name: $('qb-last-name').value.trim() || null,
    cnic: $('qb-cnic').value.trim() || null,
    phone_code: '+92',
    phone_prefix: $('qb-phone-prefix').value.trim(),
    phone_number: $('qb-phone-num').value.trim(),
    created_by: user.id,
    username: user.username,
  };

  try {
    await api.createBookingAtomic(payload);
    closeModal('quick-book-modal');
    showToast(`✅ ${resType} booked! Use "From Booking" to check in.`, 'success');
    await loadWorkloadData();
    if ($('doctor-checkin-modal').classList.contains('open')) {
      await loadDoctorCheckinData();
    }
    $('qb-form').reset();
  } catch (err) {
    $('qb-error').textContent = err.message || 'Booking failed.';
    $('qb-error').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm Booking';
  }
}

// =========================================================
// REALTIME EVENT HANDLER
// =========================================================
function onRealtimeEvent({ event, record }) {
  setUpdatedTimestamp();

  if (event === 'booking_created' && record?.created_by !== user.id) {
    showToast('📢 New appointment booked by staff.', 'info');
  }

  loadWorkloadData();
  if ($('doctor-checkin-modal').classList.contains('open')) {
    loadDoctorCheckinData();
  }
  if ($('modern-list-modal').classList.contains('open')) {
    loadModernListData();
  }
  if (!$('search-results-section').classList.contains('hidden')) {
    performSearch();
  }
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

init();
