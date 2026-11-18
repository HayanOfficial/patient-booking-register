// ==============================================================================
// Reception Appointment Dashboard Controller
// Replicates /reference/dashbord 1.png, booking.png, booking checkin.png
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
let currentSubTab = 'pending'; // 'pending' or 'checked_in'
let cachedWorkload = [];
let activeBookings = [];

async function init() {
  // Setup user menu
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
  $('btn-from-waiting').addEventListener('click', () => { window.location.href = './booking.html#waiting-list'; });
  $('btn-add-waiting').addEventListener('click', () => openQuickBookModal('Walk-in'));

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
  // SELECT DOCTOR MODAL — matching /reference/booking.png
  // =========================================================
  $('select-doctor-close').addEventListener('click', () => closeModal('select-doctor-modal'));
  $('select-doctor-close-btn').addEventListener('click', () => closeModal('select-doctor-modal'));

  // "View Today's Booking" button — goes straight to first doctor's check-in
  $('btn-view-today-modal').addEventListener('click', () => {
    closeModal('select-doctor-modal');
    if (activeDoctors.length > 0) {
      openDoctorCheckin(activeDoctors[0].id);
    } else {
      showToast('No active doctors found.', 'info');
    }
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
  // DOCTOR CHECK-IN MODAL — matching /reference/booking checkin.png
  // =========================================================
  $('doctor-checkin-close').addEventListener('click', () => closeModal('doctor-checkin-modal'));
  $('doctor-checkin-close-btn').addEventListener('click', () => closeModal('doctor-checkin-modal'));
  $('btn-back-to-doctors').addEventListener('click', () => {
    closeModal('doctor-checkin-modal');
    openSelectDoctorModal();
  });

  $('tab-checkin-pending').addEventListener('click', () => switchCheckinSubTab('pending'));
  $('tab-checkin-checked').addEventListener('click', () => switchCheckinSubTab('checked_in'));
  $('checkin-patient-search').addEventListener('input', e => filterCheckinTable(e.target.value));

  // Quick Book modal handlers
  $('qb-close').addEventListener('click', () => closeModal('quick-book-modal'));
  $('qb-cancel').addEventListener('click', () => closeModal('quick-book-modal'));
  $('qb-form').addEventListener('submit', handleQuickBookSubmit);
  $('qb-doc-select').addEventListener('change', onQuickBookDoctorChange);

  // Load Initial Data
  await loadLookupsAndDoctors();
  await loadWorkloadData();

  // Start Realtime (no manual refresh button!)
  startRealtime(onRealtimeEvent, '#realtime-indicator');
  setUpdatedTimestamp();
}

function updateDateDisplay() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Karachi' };
  $('hdr-date-text').textContent = now.toLocaleDateString('en-US', options);
  $('checkin-date').textContent = currentDate;
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
    <div class="workload-card" data-doctor-id="${w.id}" style="cursor:pointer;" title="Click to open check-in desk">
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
// SELECT DOCTOR MODAL — doctor cards (reference/booking.png)
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
        <span style="color:#475569;">📅 ${w.total_bookings} bookings today &nbsp;·&nbsp; ⏳ ${w.pending_count} pending</span>
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

// --- Select Doctor & Check-in Desk Modals ---
function openSelectDoctorModal() {
  // Always refresh data when opening
  loadWorkloadData().then(() => {
    $('select-doctor-modal').classList.add('open');
    $('modal-quick-doctor-search').value = '';
    $('modal-find-patient-input').value = '';
    filterDoctorCards('');
  });
}

// =========================================================
// DOCTOR CHECK-IN MODAL — (reference/booking checkin.png)
// =========================================================
async function openDoctorCheckin(doctorId) {
  selectedDoctorId = doctorId;
  const doc = activeDoctors.find(d => d.id === doctorId);
  currentSubTab = 'pending'; // always start on Pending tab

  // Update modal header
  $('checkin-doc-name').textContent = doc ? doc.name : 'Doctor';
  $('checkin-date').textContent = currentDate;
  $('checkin-patient-search').value = '';

  // Reset tab UI
  $('tab-checkin-pending').classList.add('active');
  $('tab-checkin-checked').classList.remove('active');

  $('doctor-checkin-modal').classList.add('open');

  // Show spinner while loading
  const tbody = $('checkin-bookings-table').querySelector('tbody');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="7" style="text-align:center;padding:28px;">⏳ Loading bookings...</td></tr>`;

  await loadDoctorCheckinData();
}

async function loadDoctorCheckinData() {
  if (!selectedDoctorId) return;

  try {
    // Load all bookings for this doctor today (for tab badge counts)
    const allForDoc = await api.getReceptionBookings(selectedDoctorId, currentDate, 'all');
    const pendingBookings = allForDoc.filter(b => b.status === 'pending');
    const checkedInBookings = allForDoc.filter(b =>
      b.status === 'checked_in' || b.status === 'in_process' || b.status === 'completed'
    );

    $('badge-pending-count').textContent = pendingBookings.length;
    $('badge-checked-count').textContent = checkedInBookings.length;

    // Show the right set
    if (currentSubTab === 'pending') {
      activeBookings = pendingBookings.sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0));
    } else {
      activeBookings = checkedInBookings.sort((a, b) => (a.token_number || 9999) - (b.token_number || 9999));
    }

    renderCheckinTable(activeBookings);
  } catch (err) {
    console.error('loadDoctorCheckinData error:', err);
    const tbody = $('checkin-bookings-table').querySelector('tbody');
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7" style="color:#ef4444;">Failed to load: ${err.message}</td></tr>`;
  }
}

function switchCheckinSubTab(tab) {
  currentSubTab = tab;
  $('tab-checkin-pending').classList.toggle('active', tab === 'pending');
  $('tab-checkin-checked').classList.toggle('active', tab === 'checked_in');
  $('checkin-patient-search').value = '';
  loadDoctorCheckinData();
}

// =========================================================
// TABLE RENDER — matching /reference/booking checkin.png
// =========================================================
function renderCheckinTable(bookings) {
  const tbody = $('checkin-bookings-table').querySelector('tbody');

  if (!bookings || bookings.length === 0) {
    const emptyMsg = currentSubTab === 'pending'
      ? 'No pending appointments for today.'
      : 'No checked-in patients yet.';
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7" style="text-align:center;padding:32px;">
          <div style="color:#64748b;font-size:.9rem;margin-bottom:12px;">${emptyMsg}</div>
          ${currentSubTab === 'pending' ? `<button class="btn btn--primary btn--sm" onclick="document.getElementById('btn-add-walkin').click();document.getElementById('doctor-checkin-modal').classList.remove('open');">➕ Add Walk-in Patient</button>` : ''}
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = bookings.map((b, idx) => {
    const p = b.patient || {};
    const patientName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient';
    const timeFormatted = b.slot_time_formatted || b.slot_time || '—';

    let actionCell = '';

    if (currentSubTab === 'pending') {
      // Blue "➜ Check-in" button — token is assigned on click
      actionCell = `
        <button class="btn-checkin-blue" data-checkin-id="${b.id}">
          ➜ Check-in
        </button>`;
    } else {
      // Already checked-in: show token badge + undo
      const tokenDisplay = b.token_number && b.token_number > 0
        ? `Token #${b.token_number}`
        : (b.token_code && b.token_code !== 'Pending' ? b.token_code : '—');

      const counselBadge = b.counseling_status === 'waiting'
        ? '<div style="margin-top:4px;"><span class="counsel-badge counsel-badge--waiting">⏳ Counseling</span></div>'
        : b.counseling_status === 'in_counseling'
        ? '<div style="margin-top:4px;"><span class="counsel-badge counsel-badge--in_counseling">💬 In Session</span></div>'
        : b.counseling_status === 'done'
        ? '<div style="margin-top:4px;"><span class="counsel-badge counsel-badge--done">✅ Done</span></div>'
        : '';

      actionCell = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-weight:800;color:#1e3a8a;background:#dbeafe;padding:2px 10px;border-radius:4px;font-size:.85rem;">${tokenDisplay}</span>
            <button class="btn btn--secondary btn--sm" data-undo-id="${b.id}" title="Undo check-in">↩</button>
          </div>
          <div style="font-size:.7rem;color:#059669;">In: ${formatTimestamp(b.checked_in_at || b.check_in_time)}</div>
          ${counselBadge}
        </div>`;
    }

    // Source badge styling
    const src = b.source || 'Direct';
    const srcColors = {
      'Self': '#4f46e5', 'Tiktok': '#000', 'Facebook': '#1877f2',
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
        <td style="text-align:center;">${actionCell}</td>
      </tr>
    `;
  }).join('');

  // ---- Check-in button handlers ----
  tbody.querySelectorAll('[data-checkin-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bId = btn.dataset.checkinId;
      btn.disabled = true;
      btn.textContent = 'Checking in...';
      btn.style.opacity = '0.7';
      try {
        const res = await api.checkinBooking(bId);
        const tokenNum = res.token_number;
        showToast(`✅ Checked In! Token #${tokenNum} assigned.`, 'success');

        // Refresh table & workload
        await loadDoctorCheckinData();
        await loadWorkloadData();

        // Auto-print token slip
        const booking = activeBookings.find(x => x.id === bId) || res.booking || {};
        printTokenSlip({ ...booking, token_number: tokenNum }, tokenNum);
      } catch (err) {
        showToast('Check-in failed: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '➜ Check-in';
        btn.style.opacity = '';
      }
    });
  });

  // ---- Undo button handlers ----
  tbody.querySelectorAll('[data-undo-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bId = btn.dataset.undoId;
      if (!confirmDialog('Undo check-in? The token number will be voided and not reused.')) return;
      try {
        await api.undoCheckinBooking(bId);
        showToast('Check-in undone. Status set back to pending.', 'info');
        await loadDoctorCheckinData();
        await loadWorkloadData();
      } catch (err) {
        showToast('Undo failed: ' + err.message, 'error');
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
  if (!tokenNum || tokenNum <= 0) return; // don't print for placeholder tokens
  sessionStorage.setItem('print_token_data', JSON.stringify({
    ...booking,
    token_number: tokenNum,
    token_code: String(tokenNum),
    checked_in_at: new Date().toISOString(),
  }));
  window.open('./print-token.html', '_blank', 'width=420,height=600');
}

// --- Search functionality ---
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

// --- Quick Book Modal ---
function openQuickBookModal(resType = 'Appointment') {
  $('qb-res-type').value = resType;
  $('qb-error').classList.add('hidden');
  $('qb-time').textContent = resType === 'Walk-in' ? 'Walk-in Entry' : 'Next Available';

  // Populate doctor select
  const docSelect = $('qb-doc-select');
  docSelect.innerHTML = activeDoctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  if (selectedDoctorId) docSelect.value = selectedDoctorId;

  onQuickBookDoctorChange();

  // Populate Purpose & Source
  $('qb-purpose').innerHTML = lookups.purpose.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  $('qb-source').innerHTML = lookups.source.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

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
    if (selectedDoctorId === docId && $('doctor-checkin-modal').classList.contains('open')) {
      await loadDoctorCheckinData();
    }
    // Reset form
    $('qb-form').reset();
  } catch (err) {
    $('qb-error').textContent = err.message || 'Booking failed.';
    $('qb-error').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm Booking';
  }
}

// --- Realtime Event Handler ---
function onRealtimeEvent({ event, record }) {
  setUpdatedTimestamp();

  if (event === 'booking_created' && record?.created_by !== user.id) {
    showToast('📢 New appointment booked by staff.', 'info');
  }

  loadWorkloadData();
  if ($('doctor-checkin-modal').classList.contains('open')) {
    loadDoctorCheckinData();
  }
  if (!$('search-results-section').classList.contains('hidden')) {
    performSearch();
  }
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

init();
