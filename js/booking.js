// ==============================================================================
// Booking Page Controller
// ==============================================================================
import { requireAuth, getSession, logout } from './auth.js';
import { api } from './api.js';
import { startRealtime } from './realtime.js';
import {
  todayDateString, formatDateDisplay, formatTimestamp, offsetDate,
  showToast, confirmDialog, debounce, getStatusLabel, getStatusClass,
  STATUS_CONFIG
} from './utils.js';
import { SlotEngine } from './slot-engine.js';
import Chart from 'chart.js/auto';

// Guard authentication
const user = requireAuth();
if (!user) throw new Error('Not authenticated');

// --- State ---
let currentDate    = todayDateString();
let currentDoctor  = null;
let currentShift   = null;
let allBookings    = [];
let allSlots       = [];
let allDoctors     = [];
let allShifts      = [];
let lookups        = { source: [], purpose: [], called_as: [], city: [], area: [] };
let statsData      = null;
let activeFilter   = 'all'; // stat card filter
let searchFilter   = '';
let _qbSlot        = null;    // current slot being quick-booked
let _selectedPatient = null;  // patient selected in quick book search
let _editBookingId = null;
let _charts        = {};

// --- DOM Refs ---
const $ = id => document.getElementById(id);

async function init() {
  // Header Info
  try {
    const c = await api.getClinicInfo();
    if (c?.name) $('hdr-clinic-name').textContent = c.name;
    const chip = $('qb-clinic-chip');
    if (chip && c?.name) chip.textContent = `🏢 ${c.name}`;
  } catch (err) {
    console.warn('Clinic info fetch failed:', err);
  }

  updateHeaderDate();
  $('hdr-username').textContent = user.full_name || user.username;
  $('hdr-role-label').textContent = `Role: ${user.role.toUpperCase()}`;
  if (user.role !== 'admin') {
    const ul = $('menu-users-link'); if (ul) ul.style.display = 'none';
    const sl = $('menu-settings-link'); if (sl) sl.style.display = 'none';
  }

  // Date navigation
  $('booking-date-input').value = currentDate;
  $('prev-date-btn').addEventListener('click', () => navigateDate(-1));
  $('next-date-btn').addEventListener('click', () => navigateDate(1));
  $('today-btn').addEventListener('click', () => goToDate(todayDateString()));
  $('booking-date-input').addEventListener('change', e => goToDate(e.target.value));
  $('schedule-prev').addEventListener('click', () => navigateDate(-1));
  $('schedule-next').addEventListener('click', () => navigateDate(1));
  $('schedule-today').addEventListener('click', () => goToDate(todayDateString()));
  $('update-register-btn').addEventListener('click', () => loadBookings());
  $('clear-cancelled-btn').addEventListener('click', clearCancelledRows);

  // Search filter
  $('patient-search-filter').addEventListener('input', debounce(e => {
    searchFilter = e.target.value.toLowerCase().trim();
    renderBookingTable();
  }, 250));

  // Doctor-Shift selector
  $('doctor-shift-select').addEventListener('change', onDoctorShiftChange);

  // Top tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // User menu
  $('user-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    $('user-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => $('user-menu')?.classList.remove('open'));
  $('logout-btn').addEventListener('click', () => logout());

  // Quick book modal
  $('qb-close').addEventListener('click', closeQuickBook);
  $('qb-cancel-btn').addEventListener('click', closeQuickBook);
  $('qb-confirm-btn').addEventListener('click', confirmBooking);
  $('toggle-search-btn').addEventListener('click', () => setSearchMode(true));
  $('toggle-manual-btn').addEventListener('click', () => setSearchMode(false));
  $('patient-search-input').addEventListener('input', debounce(onPatientSearch, 300));
  $('clear-patient-btn').addEventListener('click', clearSelectedPatient);
  $('qb-city').addEventListener('change', onCityChange);

  // Edit modal
  $('edit-close').addEventListener('click', () => closeModal('edit-booking-modal'));
  $('edit-cancel-btn').addEventListener('click', () => closeModal('edit-booking-modal'));
  $('edit-save-btn').addEventListener('click', saveEditBooking);

  // History modal
  $('history-close').addEventListener('click', () => closeModal('history-modal'));
  $('history-close-btn').addEventListener('click', () => closeModal('history-modal'));

  // Waiting list
  $('add-waiting-btn').addEventListener('click', openWaitingModal);
  $('waiting-modal-close').addEventListener('click', () => closeModal('waiting-add-modal'));
  $('wl-cancel-btn').addEventListener('click', () => closeModal('waiting-add-modal'));
  $('wl-confirm-btn').addEventListener('click', confirmWaitingListAdd);

  // Close modals on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Load initial dataset
  await loadLookups();
  await loadDoctorsAndShifts();

  // Start Realtime with connection indicator
  startRealtime(onRealtimeEvent, '#realtime-indicator');

  // Clock tick
  setInterval(updateHeaderDate, 60000);
}

function updateHeaderDate() {
  const dateEl = $('hdr-today-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  }
}

// --- Tab Switching ---
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));
  if (tabId === 'booking-graph') renderGraphs();
  if (tabId === 'booking-analytics') renderAnalytics();
  if (tabId === 'waiting-list') loadWaitingList();
}

// --- Date Navigation ---
function navigateDate(delta) { goToDate(offsetDate(currentDate, delta)); }
function goToDate(dateStr) {
  currentDate = dateStr;
  $('booking-date-input').value = dateStr;
  loadBookings();
}

// --- Doctor/Shift Handlers ---
async function loadDoctorsAndShifts() {
  allDoctors = await api.getActiveDoctors();
  const sel = $('doctor-shift-select');
  sel.innerHTML = '<option value="">— Select Doctor & Shift —</option>';
  allShifts = [];
  for (const doc of allDoctors) {
    const shifts = await api.getShifts(doc.id);
    allShifts.push(...shifts);
    for (const shift of shifts) {
      const opt = document.createElement('option');
      opt.value = `${doc.id}|${shift.id}`;
      opt.textContent = `${doc.name} — ${shift.name}`;
      sel.appendChild(opt);
    }
  }

  // Default selection
  if (sel.options.length > 1) {
    sel.selectedIndex = 1;
    onDoctorShiftChange();
  }
}

function onDoctorShiftChange() {
  const val = $('doctor-shift-select').value;
  if (!val) { currentDoctor = null; currentShift = null; return; }
  const [docId, shiftId] = val.split('|');
  currentDoctor = allDoctors.find(d => d.id === docId) || null;
  currentShift  = allShifts.find(s => s.id === shiftId) || null;
  updateDoctorDisplay();
  loadBookings();
}

function updateDoctorDisplay() {
  const disp = $('doctor-display');
  if (!currentDoctor) { disp.style.display = 'none'; return; }
  disp.style.display = 'flex';
  $('doctor-avatar').textContent = (currentDoctor.name || 'D').charAt(0).toUpperCase();
  $('doctor-name-display').textContent = currentDoctor.name;
  $('doctor-spec-display').textContent = currentDoctor.specialty || '';
}

// --- Lookups ---
async function loadLookups() {
  const cats = ['source', 'purpose', 'called_as', 'city', 'area'];
  await Promise.all(cats.map(async cat => {
    lookups[cat] = await api.getLookupsByCategory(cat);
  }));

  populateSelect('qb-purpose', lookups.purpose);
  populateSelect('qb-source', lookups.source);
  populateSelect('qb-called-as', lookups.called_as);
  populateSelect('qb-city', lookups.city, '— Select City —');
  populateSelect('edit-purpose', lookups.purpose);
  populateSelect('edit-source', lookups.source);
  populateSelect('edit-called-as', lookups.called_as);
  populateSelect('wl-purpose', lookups.purpose);
  populateSelect('wl-source', lookups.source);
}

function populateSelect(id, items, placeholder = null) {
  const el = $(id); if (!el) return;
  el.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = placeholder;
    el.appendChild(opt);
  }
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.textContent = item.name;
    el.appendChild(opt);
  });
}

// --- Load Bookings ---
async function loadBookings() {
  if (!currentDoctor || !currentShift) {
    $('booking-tbody').innerHTML = '<tr class="empty-row"><td colspan="8">Select a Doctor &amp; Shift to view the booking register.</td></tr>';
    renderStatCards(null);
    return;
  }
  $('booking-tbody').innerHTML = '<tr class="loading-row"><td colspan="8"><span class="spinner"></span> Loading slots &amp; bookings...</td></tr>';
  try {
    const [bookings, stats] = await Promise.all([
      api.getBookingsForShiftAndDate(currentDate, currentDoctor.id, currentShift.id),
      api.getDailyStats(currentDate, currentDoctor.id, currentShift.id),
    ]);
    allBookings = bookings;
    statsData   = stats;
    allSlots    = SlotEngine.generateSlots(currentShift, bookings);
    renderStatCards(stats);
    renderBookingTable();
  } catch (e) {
    console.error('loadBookings error', e);
    $('booking-tbody').innerHTML = `<tr class="empty-row"><td colspan="8">Error loading bookings: ${e.message}</td></tr>`;
  }
}

// --- Stat Cards ---
function renderStatCards(stats) {
  const container = $('stat-cards');
  if (!stats) { container.innerHTML = '<div class="stat-card"><span class="text-muted">No data</span></div>'; return; }

  const cards = [
    { id: 'all', label: 'SHOW ALL', value: '☰', cls: '', filter: 'all', extra: '' },
    { id: 'total', label: 'TOTAL BOOKINGS', value: stats.totalBookings, cls: 'stat-card--total', filter: 'total', extra: '' },
    { id: 'booked', label: 'BOOKED SLOTS', value: `${stats.bookedSlots}/${stats.totalSlots}`, cls: 'stat-card--booked', filter: 'booked', extra: `${stats.bookedPercentage}%` },
    { id: 'avail', label: 'AVAILABLE', value: stats.availableSlots, cls: 'stat-card--avail', filter: 'available', extra: `${stats.availablePercentage}%` },
    { id: 'checkin', label: 'CHECK-IN', value: stats.checkInCount, cls: 'stat-card--checkin', filter: 'checked_in', extra: `${stats.checkInPercentage}%` },
    { id: 'inprocess', label: 'IN PROCESS', value: stats.inProcessCount, cls: 'stat-card--inprocess', filter: 'in_process', extra: `${stats.inProcessPercentage}%` },
    { id: 'pending', label: 'PENDING', value: stats.pendingCount, cls: 'stat-card--pending', filter: 'pending', extra: `${stats.pendingPercentage}%` },
    { id: 'absent', label: 'ABSENT', value: stats.absentCount, cls: 'stat-card--absent', filter: 'absent', extra: `${stats.absentPercentage}%` },
    { id: 'followup', label: 'FOLLOW-UP', value: stats.followUpCount, cls: 'stat-card--followup', filter: 'follow_up', extra: `${stats.followUpPercentage}%` },
    { id: 'remfu', label: 'REMAINING FU', value: stats.remainingFollowUpCount, cls: 'stat-card--followup', filter: 'remaining_fu', extra: `${stats.remainingFollowUpPercentage}%` },
  ];

  if (stats.sourcesCount) {
    for (const [src, cnt] of Object.entries(stats.sourcesCount)) {
      if (cnt > 0) {
        cards.push({ id: `src-${src}`, label: src.toUpperCase(), value: cnt, cls: 'stat-card--source', filter: `source:${src}`, extra: '' });
      }
    }
  }

  container.innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls} ${activeFilter === c.filter ? 'active' : ''}" data-filter="${c.filter}" role="button" tabindex="0">
      <span class="sc-label">${c.label}</span>
      <span class="sc-value">${c.value}</span>
      ${c.extra ? `<span class="sc-pct">${c.extra}</span>` : ''}
    </div>
  `).join('');

  container.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
      activeFilter = card.dataset.filter;
      container.querySelectorAll('.stat-card').forEach(c => c.classList.toggle('active', c.dataset.filter === activeFilter));
      renderBookingTable();
    });
  });
}

// --- Render Booking Table ---
function renderBookingTable() {
  const tbody = $('booking-tbody');
  if (!allSlots.length && !allBookings.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No slots available for this shift.</td></tr>';
    return;
  }

  // Apply stat card filter
  let visibleSlots = [...allSlots];
  if (activeFilter === 'available') {
    visibleSlots = visibleSlots.filter(s => !s.booking);
  } else if (activeFilter !== 'all' && activeFilter !== 'total' && activeFilter !== 'booked') {
    if (activeFilter.startsWith('source:')) {
      const src = activeFilter.slice(7);
      visibleSlots = visibleSlots.filter(s => s.booking?.source?.toLowerCase() === src.toLowerCase());
    } else if (activeFilter === 'remaining_fu') {
      visibleSlots = visibleSlots.filter(s => s.booking && (s.booking.status === 'follow_up' || s.booking.purpose?.toLowerCase().includes('follow')) && s.booking.status === 'pending');
    } else {
      visibleSlots = visibleSlots.filter(s => s.booking?.status === activeFilter);
    }
  } else if (activeFilter === 'booked') {
    visibleSlots = visibleSlots.filter(s => s.booking);
  }

  // Quick search filter
  if (searchFilter) {
    visibleSlots = visibleSlots.filter(s => {
      if (!s.booking) return false;
      const p = s.booking.patient || {};
      const haystack = [p.first_name, p.last_name, p.full_phone, p.cnic, p.patient_mrn, s.booking.source, s.booking.purpose, s.booking.token_code].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchFilter);
    });
  }

  if (!visibleSlots.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No slots match the current filter.</td></tr>';
    return;
  }

  tbody.innerHTML = visibleSlots.map((slot) => {
    if (!slot.booking) {
      // Empty unbooked slot
      return `<tr class="quick-book-row" data-slot="${slot.index}">
        <td style="color:#9ca3af;font-size:.78rem;">${slot.index}</td>
        <td><span class="slot-time-pill" style="background:#fef9e7;color:#92400e;">${slot.slotTimeFormatted}</span></td>
        <td colspan="6">
          <button class="quick-book-btn" data-slot="${slot.index}" data-slot-time="${slot.slotTime}" data-slot-formatted="${slot.slotTimeFormatted}">
            📅 Quick Book Slot
          </button>
        </td>
      </tr>`;
    }

    const b = slot.booking;
    const p = b.patient || {};

    const calledAsColor = {
      'Hospital Patient': 'teal',
      'VIP': 'amber',
      'Staff Member': 'green',
      'Relative': 'purple'
    }[b.called_as] || 'gray';

    const visitInfo = (b.status === 'checked_in' || b.status === 'in_process' || b.status === 'completed')
      ? `<button class="status-pill ${getStatusClass(b.status)}" data-booking="${b.id}" data-action="status-menu">${getStatusLabel(b.status)}</button>
         ${b.check_in_time ? `<div style="font-size:.7rem;color:#6b7280;margin-top:3px;">In: ${formatTimestamp(b.check_in_time)}</div>` : ''}`
      : `<button class="status-pill ${getStatusClass(b.status)}" data-booking="${b.id}" data-action="status-menu">${getStatusLabel(b.status)}</button>`;

    const canEdit   = user.role === 'admin' || user.role === 'receptionist' || (user.role === 'operator' && b.reservation_type === 'Appointment');
    const canDelete = user.role === 'admin';

    return `<tr data-booking-id="${b.id}">
      <td style="color:#6b7280;font-size:.82rem;">${slot.index}</td>
      <td><span class="slot-time-pill">${slot.slotTimeFormatted}</span></td>
      <td>
        <div class="patient-name">
          <span>👤</span>
          <span>${p.first_name || '—'} ${p.last_name || ''}</span>
          <span class="badge badge--${calledAsColor}">${b.called_as || 'Hospital Patient'}</span>
        </div>
        <div class="patient-info">
          ${p.full_phone ? `<span>📞 ${p.full_phone}</span>` : ''}
          ${p.city ? `<span>📍 ${p.city}${p.area ? ' ' + p.area : ''}</span>` : ''}
          ${p.age ? `<span>🎂 ${p.age} yr</span>` : ''}
          ${p.cnic ? `<span style="color:#9ca3af;">🆔 ${p.cnic}</span>` : ''}
          <span style="font-weight:600;color:#1e40af;">[${b.token_code}]</span>
        </div>
      </td>
      <td><span class="source-badge badge badge--blue" style="background:#eff6ff;color:#1d4ed8;">${b.source || '—'}</span></td>
      <td><span class="badge badge--red" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca;">🎯 ${b.purpose || '—'}</span></td>
      <td><span class="appt-badge appt-badge--${b.reservation_type === 'Walk-in' ? 'walkin' : 'appointment'}">✓ ${b.reservation_type || 'Appointment'}</span></td>
      <td>${visitInfo}</td>
      <td>
        <div class="actions-cell">
          <button class="action-btn" title="Call" onclick="window.open('tel:${p.full_phone || ''}')">📞</button>
          ${canEdit ? `<button class="action-btn" title="Edit booking" data-booking="${b.id}" data-action="edit">✏️</button>` : ''}
          <button class="action-btn" title="Print token" data-booking="${b.id}" data-action="print">🖨️</button>
          <button class="action-btn" title="Patient history" data-booking="${b.id}" data-action="history">📋</button>
          ${canDelete ? `<button class="action-btn action-btn--danger" title="Delete booking" data-booking="${b.id}" data-action="delete">🗑</button>` : ''}
          <div class="dropdown">
            <button class="action-btn" data-booking="${b.id}" data-action="more">⋯</button>
            <div class="dropdown-menu" id="dm-${b.id}">
              ${['checked_in','in_process','completed','absent','follow_up','cancelled'].map(s => `
                <button class="dropdown-item" data-booking="${b.id}" data-action="set-status" data-status="${s}">
                  ${STATUS_CONFIG[s]?.icon || ''} ${getStatusLabel(s)}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// Attach event listeners for table buttons
$('booking-tbody').addEventListener('click', onTableClick);

function onTableClick(e) {
  const qbBtn = e.target.closest('.quick-book-btn');
  if (qbBtn) {
    const slot = {
      index: parseInt(qbBtn.dataset.slot, 10),
      slotTime: qbBtn.dataset.slotTime,
      slotTimeFormatted: qbBtn.dataset.slotFormatted || ''
    };
    openQuickBook(slot);
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const bookingId = btn.dataset.booking;
  if (!bookingId) return;

  const booking = allBookings.find(b => b.id === bookingId);
  if (!booking) return;

  if (action === 'status-menu' || action === 'more') {
    const dm = document.getElementById(`dm-${bookingId}`);
    if (dm) {
      document.querySelectorAll('.dropdown-menu').forEach(d => d !== dm && d.classList.remove('open'));
      dm.classList.toggle('open');
    }
  } else if (action === 'set-status') {
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('open'));
    updateStatus(bookingId, btn.dataset.status);
  } else if (action === 'edit') {
    openEditModal(booking);
  } else if (action === 'print') {
    printToken(booking);
  } else if (action === 'history') {
    openHistoryModal(booking);
  } else if (action === 'delete') {
    deleteBooking(bookingId);
  }
}

// Close open dropdown menus on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('[data-action="more"]') && !e.target.closest('[data-action="status-menu"]') && !e.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('open'));
  }
});

// --- Quick Book Modal ---
function openQuickBook(slot) {
  _qbSlot = slot;
  _selectedPatient = null;
  clearSelectedPatient();
  setSearchMode(true);

  $('qb-time').textContent = slot.slotTimeFormatted || slot.slotTime || '—';
  $('qb-chips').innerHTML = `
    <span class="qb-chip">👤 ${currentDoctor?.name || 'Doctor'}</span>
    <span class="qb-chip">🥞 ${currentShift?.name || 'Default Shift'}</span>
    <span class="qb-chip">🏢 ${$('hdr-clinic-name').textContent}</span>
  `;

  // Reset form inputs
  ['qb-first-name','qb-last-name','qb-cnic','qb-phone-number','qb-address','qb-remarks'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  $('qb-age').value = '';
  $('qb-phone-code').value = '+92';
  $('qb-phone-prefix').value = '300';
  $('qb-city').value = '';
  $('qb-area').innerHTML = '<option value="">— Select Area —</option>';
  $('qb-error').classList.add('hidden');

  document.getElementById('quick-book-modal').classList.add('open');
}

function closeQuickBook() {
  document.getElementById('quick-book-modal').classList.remove('open');
  _qbSlot = null;
  _selectedPatient = null;
}

function setSearchMode(isSearch) {
  $('toggle-search-btn').classList.toggle('active', isSearch);
  $('toggle-manual-btn').classList.toggle('active', !isSearch);
  $('search-section').style.display = isSearch ? 'block' : 'none';
  $('patient-fields').style.display = 'block';
}

async function onPatientSearch(e) {
  const q = e.target.value.trim();
  const resultsEl = $('patient-search-results');
  if (q.length < 2) { resultsEl.style.display = 'none'; return; }
  const patients = await api.searchPatients(q);
  if (!patients.length) { resultsEl.style.display = 'none'; return; }
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = patients.map(p => `
    <div class="patient-result-item" data-patient-id="${p.id}">
      <span class="pat-name">${p.first_name} ${p.last_name || ''}</span>
      <span class="pat-info">${p.full_phone || ''} &bull; ${p.patient_mrn || ''} ${p.city ? '&bull; ' + p.city : ''}</span>
    </div>
  `).join('');
  resultsEl.querySelectorAll('.patient-result-item').forEach((item, idx) => {
    item.addEventListener('click', () => selectPatient(patients[idx]));
  });
}

function selectPatient(patient) {
  _selectedPatient = patient;
  $('patient-search-results').style.display = 'none';
  $('patient-search-input').value = '';
  $('selected-patient-banner').classList.remove('hidden');
  $('sel-pat-name').textContent = `${patient.first_name} ${patient.last_name || ''}`;
  $('sel-pat-info').textContent = `${patient.full_phone || ''} • ${patient.patient_mrn || ''}`;

  // Autofill fields
  $('qb-first-name').value = patient.first_name || '';
  $('qb-last-name').value  = patient.last_name  || '';
  $('qb-cnic').value       = patient.cnic        || '';
  if (patient.phone_prefix) $('qb-phone-prefix').value = patient.phone_prefix;
  if (patient.phone_number) $('qb-phone-number').value = patient.phone_number;
  if (patient.city) { $('qb-city').value = patient.city; onCityChange(); }
  if (patient.age) $('qb-age').value = patient.age;
  if (patient.address) $('qb-address').value = patient.address;
}

function clearSelectedPatient() {
  _selectedPatient = null;
  $('selected-patient-banner').classList.add('hidden');
  $('patient-search-input').value = '';
  $('patient-search-results').style.display = 'none';
}

function onCityChange() {
  const city = $('qb-city').value;
  const areas = lookups.area.filter(a => {
    const cityItem = lookups.city.find(c => c.name === city);
    return cityItem && a.parent_id === cityItem.id;
  });
  $('qb-area').innerHTML = '<option value="">— Select Area —</option>' +
    areas.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
}

async function confirmBooking() {
  const btn = $('qb-confirm-btn');
  const errEl = $('qb-error');
  errEl.classList.add('hidden');

  const firstName = $('qb-first-name').value.trim();
  if (!firstName && !_selectedPatient) {
    errEl.textContent = 'First name is required.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Processing…';
  try {
    const payload = {
      doctor_id: currentDoctor.id,
      shift_id:  currentShift.id,
      booking_date: currentDate,
      slot_index: _qbSlot.index,
      slot_time:  _qbSlot.slotTime,
      slot_time_formatted: _qbSlot.slotTimeFormatted,
      reservation_type: $('qb-reservation-type').value,
      purpose:   $('qb-purpose').value,
      source:    $('qb-source').value,
      called_as: $('qb-called-as').value,
      first_name: firstName || (_selectedPatient?.first_name || ''),
      last_name:  $('qb-last-name').value.trim() || undefined,
      cnic:       $('qb-cnic').value.trim() || undefined,
      phone_code: $('qb-phone-code').value,
      phone_prefix: $('qb-phone-prefix').value,
      phone_number: $('qb-phone-number').value.trim(),
      city:    $('qb-city').value || undefined,
      area:    $('qb-area').value || undefined,
      address: $('qb-address').value.trim() || undefined,
      age:     $('qb-age').value ? parseInt($('qb-age').value, 10) : undefined,
      remarks: $('qb-remarks').value.trim() || undefined,
      created_by: user.id,
      username:   user.username,
      existing_patient_id: _selectedPatient?.id || undefined,
    };

    const booking = await api.createBookingAtomic(payload);
    closeQuickBook();
    showToast(`✅ Token ${booking.token_code} issued successfully!`, 'success');
    await loadBookings();
    if (confirm(`Booking created for ${booking.token_code}. Print token slip now?`)) {
      printToken(booking);
    }
  } catch (e) {
    errEl.textContent = e.message || 'Booking failed. Please try again.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Confirm Booking';
  }
}

// --- Status Update ---
async function updateStatus(bookingId, status) {
  try {
    await api.updateBookingStatus(bookingId, status, user.id, user.username);
    showToast(`Status updated to ${getStatusLabel(status)}`, 'success');
    await loadBookings();
  } catch (e) {
    showToast('Failed to update status: ' + e.message, 'error');
  }
}

// --- Edit Booking ---
function openEditModal(booking) {
  _editBookingId = booking.id;
  $('edit-purpose').value = booking.purpose || '';
  $('edit-source').value  = booking.source  || '';
  $('edit-reservation-type').value = booking.reservation_type || 'Appointment';
  $('edit-called-as').value = booking.called_as || '';
  $('edit-remarks').value = booking.remarks || '';
  document.getElementById('edit-booking-modal').classList.add('open');
}

async function saveEditBooking() {
  if (!_editBookingId) return;
  const changes = {
    purpose:   $('edit-purpose').value,
    source:    $('edit-source').value,
    reservation_type: $('edit-reservation-type').value,
    called_as: $('edit-called-as').value,
    remarks:   $('edit-remarks').value.trim(),
  };
  try {
    await api.editBooking(_editBookingId, changes, user.id, user.username);
    closeModal('edit-booking-modal');
    showToast('Booking updated successfully.', 'success');
    await loadBookings();
  } catch (e) {
    showToast('Failed to save changes: ' + e.message, 'error');
  }
}

// --- Print Token ---
function printToken(booking) {
  sessionStorage.setItem('print_token_data', JSON.stringify(booking));
  api.reprintToken(booking.id, user.id, user.username).catch(() => {});
  window.open(`./print-token.html?id=${booking.id}`, '_blank', 'width=420,height=620,resizable=yes');
}

// --- Patient History ---
async function openHistoryModal(booking) {
  const p = booking.patient || {};
  $('history-patient-info').innerHTML = `
    <strong>${p.first_name || '—'} ${p.last_name || ''}</strong>
    <span style="color:#6b7280;margin-left:8px;">MRN: ${p.patient_mrn || '—'}</span>
    <span style="color:#6b7280;margin-left:8px;">📞 ${p.full_phone || '—'}</span>
  `;
  $('history-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;"><span class="spinner"></span> Loading history...</td></tr>';
  document.getElementById('history-modal').classList.add('open');
  try {
    const history = await api.getPatientHistory(booking.patient_id);
    if (!history.length) {
      $('history-tbody').innerHTML = '<tr class="empty-row"><td colspan="7">No previous bookings found.</td></tr>';
      return;
    }
    $('history-tbody').innerHTML = history.map(h => `
      <tr>
        <td>${h.booking_date}</td>
        <td><strong>${h.token_code}</strong></td>
        <td>${h.slot_time_formatted || h.slot_time || ''}</td>
        <td>${h.doctor_name || '—'}</td>
        <td>${h.purpose || '—'}</td>
        <td>${h.source || '—'}</td>
        <td><span class="status-pill ${getStatusClass(h.status)}" style="font-size:.72rem;padding:2px 8px;">${getStatusLabel(h.status)}</span></td>
      </tr>
    `).join('');
  } catch (e) {
    $('history-tbody').innerHTML = `<tr class="empty-row"><td colspan="7">Error loading history: ${e.message}</td></tr>`;
  }
}

// --- Delete Booking ---
async function deleteBooking(bookingId) {
  if (!confirmDialog('Delete this booking? This will free the slot.')) return;
  try {
    await api.softDeleteBooking(bookingId, user.id, user.username);
    showToast('Booking deleted.', 'success');
    await loadBookings();
  } catch (e) {
    showToast('Failed to delete booking: ' + e.message, 'error');
  }
}

function clearCancelledRows() {
  allBookings = allBookings.filter(b => b.status !== 'cancelled');
  allSlots = SlotEngine.generateSlots(currentShift, allBookings);
  renderBookingTable();
  showToast('Cancelled rows hidden.', 'info');
}

// --- Waiting List Tab ---
async function loadWaitingList() {
  if (!currentDoctor || !currentShift) {
    $('waiting-tbody').innerHTML = '<tr class="empty-row"><td colspan="8">Select a Doctor &amp; Shift first.</td></tr>';
    return;
  }
  const items = await api.getWaitingList(currentDate, currentDoctor.id, currentShift.id);
  if (!items.length) {
    $('waiting-tbody').innerHTML = '<tr class="empty-row"><td colspan="8">No patients on waiting list.</td></tr>';
    return;
  }
  $('waiting-tbody').innerHTML = items.map((w, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${w.patient_name}</strong></td>
      <td>${w.phone}</td>
      <td>${w.purpose || '—'}</td>
      <td>${w.source || '—'}</td>
      <td>${w.notes || '—'}</td>
      <td style="font-size:.75rem;color:#6b7280;">${formatTimestamp(w.created_at)}</td>
      <td>
        <button class="btn btn--primary btn--sm" data-wl="${w.id}" data-action="wl-convert">📋 Book</button>
        <button class="btn btn--ghost btn--sm" data-wl="${w.id}" data-action="wl-cancel">✕</button>
      </td>
    </tr>
  `).join('');

  $('waiting-tbody').querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.wl;
      if (btn.dataset.action === 'wl-cancel') {
        api.cancelWaitingListItem(id).then(() => loadWaitingList());
      } else if (btn.dataset.action === 'wl-convert') {
        const item = items.find(x => x.id === id);
        if (item) {
          switchTab('booking-sheet');
          const emptySlot = allSlots.find(s => !s.booking);
          if (emptySlot) {
            openQuickBook(emptySlot);
            $('qb-first-name').value = item.patient_name;
            $('qb-phone-number').value = item.phone.slice(-7);
            $('qb-purpose').value = item.purpose || 'Consultation';
            $('qb-source').value = item.source || 'Self';
          } else {
            showToast('No free slots available to convert waiting patient.', 'warning');
          }
        }
      }
    });
  });
}

function openWaitingModal() {
  $('wl-name').value = ''; $('wl-phone').value = ''; $('wl-notes').value = '';
  document.getElementById('waiting-add-modal').classList.add('open');
}

async function confirmWaitingListAdd() {
  const name  = $('wl-name').value.trim();
  const phone = $('wl-phone').value.trim();
  if (!name || !phone) { showToast('Name and phone are required.', 'error'); return; }
  try {
    await api.addWaitingListItem({
      booking_date: currentDate,
      doctor_id: currentDoctor?.id || '',
      shift_id:  currentShift?.id  || '',
      patient_name: name,
      phone,
      purpose: $('wl-purpose').value,
      source:  $('wl-source').value,
      notes:   $('wl-notes').value.trim(),
      priority: 1,
      created_by: user.id,
    });
    closeModal('waiting-add-modal');
    showToast('Added to waiting list.', 'success');
    loadWaitingList();
  } catch (e) {
    showToast('Failed to add to waiting list: ' + e.message, 'error');
  }
}

// --- Chart.js Graphs ---
async function renderGraphs() {
  if (!statsData) return;

  const srcCtx = $('source-chart');
  if (srcCtx && statsData.sourcesCount) {
    if (_charts.source) _charts.source.destroy();
    const labels = Object.keys(statsData.sourcesCount);
    const data   = Object.values(statsData.sourcesCount);
    const colors = ['#3B82F6','#1877F2','#EF4444','#E1306C','#10B981','#F59E0B','#25D366','#8B5CF6','#EC4899'];
    _charts.source = new Chart(srcCtx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
      options: { plugins: { legend: { display: false } }, cutout: '65%' }
    });
    const legend = $('source-legend');
    if (legend) {
      legend.innerHTML = labels.map((l, i) => `
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:12px;height:12px;background:${colors[i % colors.length]};border-radius:3px;flex-shrink:0;"></span>
          <span style="font-size:.8rem;">${l}</span>
          <strong style="margin-left:auto;">${data[i]}</strong>
        </div>
      `).join('');
    }
  }

  const statCtx = $('status-chart');
  if (statCtx) {
    if (_charts.status) _charts.status.destroy();
    _charts.status = new Chart(statCtx, {
      type: 'bar',
      data: {
        labels: ['Checked In','In Process','Pending','Absent','Follow Up','Completed'],
        datasets: [{
          data: [
            statsData.checkInCount,
            statsData.inProcessCount,
            statsData.pendingCount,
            statsData.absentCount,
            statsData.followUpCount,
            statsData.completedCount
          ],
          backgroundColor: ['#10B981','#F97316','#F59E0B','#EF4444','#3B82F6','#059669'],
          borderRadius: 6
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }
}

async function renderAnalytics() {
  const endDate   = todayDateString();
  const startDate = offsetDate(endDate, -29);
  const trends    = await api.getReportTrends(startDate, endDate);
  const ctx = $('analytics-chart');
  if (ctx) {
    if (_charts.analytics) _charts.analytics.destroy();
    _charts.analytics = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trends.map(t => t.period),
        datasets: [
          { label: 'Total Bookings', data: trends.map(t => t.total_bookings), borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,.1)', fill: true, tension: .4 },
          { label: 'Attended', data: trends.map(t => t.attended), borderColor: '#10B981', backgroundColor: 'transparent', tension: .4 },
          { label: 'Absent', data: trends.map(t => t.absent), borderColor: '#EF4444', backgroundColor: 'transparent', tension: .4 },
        ]
      },
      options: { plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    });
  }

  const overview = await api.getReportOverview(startDate, endDate);
  const grid = $('analytics-summary');
  if (grid) {
    grid.innerHTML = [
      { label: 'TOTAL BOOKINGS (30D)', value: overview.totalBookings },
      { label: 'AVG PER DAY', value: overview.avgPerDay },
      { label: 'ATTENDED', value: overview.checkedIn + overview.completed },
      { label: 'ABSENT', value: overview.absent },
      { label: 'ABSENT RATE', value: `${overview.absentRate}%` },
    ].map(c => `
      <div class="summary-card">
        <div class="s-label">${c.label}</div>
        <div class="s-value">${c.value}</div>
      </div>
    `).join('');
  }
}

// --- Realtime Callback ---
function onRealtimeEvent({ event, record }) {
  if (!currentDoctor || !currentShift) return;
  if (event === 'tab_visible' || event === 'booking_created' || event === 'booking_updated' || event === 'booking_deleted' || event === 'waiting_list_change') {
    loadBookings();
    if (event === 'booking_created' && record?.created_by !== user.id) {
      showToast(`📢 New booking received: ${record?.token_code || ''}`, 'info');
    }
  }
}

function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// Bootstrap page
init();

