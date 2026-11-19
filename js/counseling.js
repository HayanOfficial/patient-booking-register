// ==============================================================================
// js/counseling.js — Counseling Dashboard Controller
// Role: Counselor or Admin only
// ==============================================================================
import { requireAuth, logout } from './auth.js';
import { api } from './api.js';
import { showToast, confirmDialog, formatTimestamp, formatWaitTime, debounce, todayDateString } from './utils.js';
import { startRealtime } from './realtime.js';

// --- Auth ---
const user = requireAuth(['admin', 'counselor']);
if (!user) throw new Error('Unauthorized');

const $ = id => document.getElementById(id);

// --- State ---
let _queue = [];          // all counseling sessions for today
let _procedures = [];     // all active procedures from DB
let _activeTab = 'waiting';
let _searchQuery = '';
let _doctorFilter = '';
let _activePanelSession = null; // the session being worked on
let _selectedProcs = [];        // [{procedure_id, procedure_name_snapshot, procedure_category_snapshot, quoted_price, sort_order}]
let _procSearchQuery = '';
let _waitTimerHandle = null;

// ==============================================================================
// INIT
// ==============================================================================
async function init() {
  $('hdr-username').textContent = user.full_name || user.username;
  if (user.role !== 'admin') {
    $('counseling-nav-reception')?.remove();
    $('counseling-nav-booking')?.remove();
  }
  $('logout-btn').addEventListener('click', () => logout());
  $('user-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    $('user-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => $('user-menu')?.classList.remove('open'));

  // Header date/time
  updateHeaderTime();
  setInterval(updateHeaderTime, 1000);

  // Doctor filter
  await loadDoctorFilter();

  // Load procedures (for the panel)
  _procedures = await api.getActiveProcedures();

  // Load initial queue
  await refreshQueue();

  // Wire up tab buttons
  document.querySelectorAll('.counsel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      document.querySelectorAll('.counsel-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderTable();
    });
  });

  // Doctor filter
  $('filter-doctor').addEventListener('change', e => {
    _doctorFilter = e.target.value;
    refreshQueue();
  });

  // Search
  const doSearch = debounce(() => {
    _searchQuery = $('search-input').value.trim().toLowerCase();
    $('search-clear').classList.toggle('hidden', !_searchQuery);
    renderTable();
  }, 300);
  $('search-input').addEventListener('input', doSearch);
  $('search-btn').addEventListener('click', doSearch);
  $('search-clear').addEventListener('click', () => {
    $('search-input').value = '';
    _searchQuery = '';
    $('search-clear').classList.add('hidden');
    renderTable();
  });

  // Panel
  $('cp-close-btn').addEventListener('click', closePanel);
  $('counsel-panel-backdrop').addEventListener('click', closePanel);
  $('cp-save-draft-btn').addEventListener('click', () => saveCounseling(false));
  $('cp-complete-btn').addEventListener('click', () => saveCounseling(true));
  $('cp-undo-btn').addEventListener('click', undoCounselingCheckin);

  // Procedure search in panel
  const doProcSearch = debounce(() => {
    _procSearchQuery = $('proc-search-input').value.trim().toLowerCase();
    renderProcedureList();
  }, 200);
  $('proc-search-input').addEventListener('input', doProcSearch);

  // Event delegation for table actions
  $('counseling-tbody').addEventListener('click', handleTableClick);

  // Realtime
  startRealtime(onRealtimeEvent);

  // Live wait-time updater
  _waitTimerHandle = setInterval(() => {
    document.querySelectorAll('[data-wait-since]').forEach(el => {
      el.textContent = formatWaitTime(el.dataset.waitSince);
    });
  }, 30000);
}

// ==============================================================================
// HEADER TIME
// ==============================================================================
function updateHeaderTime() {
  const now = new Date();
  $('hdr-date-text').textContent = now.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  $('hdr-time-text').textContent = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ==============================================================================
// DOCTOR FILTER
// ==============================================================================
async function loadDoctorFilter() {
  const doctors = await api.getActiveDoctors();
  const sel = $('filter-doctor');
  sel.innerHTML = '<option value="">All Doctors</option>';
  doctors.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
}

// ==============================================================================
// QUEUE LOAD
// ==============================================================================
async function refreshQueue() {
  try {
    const today = todayDateString();
    _queue = await api.getCounselingQueue(today, _doctorFilter || null);
    renderStatCards();
    renderTable();
  } catch (err) {
    showToast('Failed to load counseling queue: ' + err.message, 'error');
  }
}

// ==============================================================================
// STAT CARDS
// ==============================================================================
function renderStatCards() {
  const waiting = _queue.filter(s => s.counseling_status === 'waiting').length;
  const active  = _queue.filter(s => s.counseling_status === 'in_counseling').length;
  const done    = _queue.filter(s => s.counseling_status === 'done').length;
  $('stat-waiting').textContent = waiting;
  $('stat-active').textContent  = active;
  $('stat-done').textContent    = done;
  $('stat-total').textContent   = _queue.length;
  $('tab-badge-waiting').textContent     = waiting;
  $('tab-badge-in_counseling').textContent = active;
  $('tab-badge-done').textContent        = done;
}

// ==============================================================================
// TABLE RENDER
// ==============================================================================
function getFilteredQueue() {
  return _queue.filter(s => {
    if (s.counseling_status !== _activeTab) return false;
    if (_searchQuery) {
      const hay = [
        s.token_number, s.first_name, s.last_name,
        s.full_phone, s.patient_mrn
      ].join(' ').toLowerCase();
      if (!hay.includes(_searchQuery)) return false;
    }
    return true;
  });
}

function renderTable() {
  const rows = getFilteredQueue();
  const tbody = $('counseling-tbody');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:32px;">
      No patients in <strong>${_activeTab.replace('_', ' ')}</strong> tab.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(s => buildRow(s)).join('');
}

function buildRow(s) {
  const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
  const phone = s.full_phone || '—';
  const mrn   = s.patient_mrn || '—';
  const age   = s.age ? `${s.age}y` : '';
  const checkinTime = s.check_in_time ? formatTimestamp(s.check_in_time, 'time') : '—';
  const waitSince = s.check_in_time || s.created_at;

  let actionBtn = '';
  if (s.counseling_status === 'waiting') {
    actionBtn = `<button class="btn btn--primary btn--sm" data-action="start" data-session-id="${s.session_id}" data-booking-id="${s.booking_id}">
      💬 Start Counseling
    </button>`;
  } else if (s.counseling_status === 'in_counseling') {
    actionBtn = `<button class="btn btn--warning btn--sm" data-action="open" data-session-id="${s.session_id}" data-booking-id="${s.booking_id}">
      📝 Continue
    </button>`;
  } else {
    actionBtn = `<button class="btn btn--ghost btn--sm" data-action="open" data-session-id="${s.session_id}" data-booking-id="${s.booking_id}">
      👁 View
    </button>
    <button class="btn btn--ghost btn--sm" data-action="reprint" data-session-id="${s.session_id}" data-booking-id="${s.booking_id}" title="Reprint Slip">🖨️</button>`;
  }

  return `<tr data-session-id="${s.session_id}" data-booking-id="${s.booking_id}">
    <td><strong style="font-size:1.1rem;color:var(--green-dark);">${s.token_number ?? '—'}</strong></td>
    <td>
      <div style="font-weight:600;">${name}</div>
      <div class="text-muted text-xs">${age} · ${phone}</div>
      <div class="text-muted text-xs">MR: ${mrn}</div>
    </td>
    <td class="text-sm">${s.doctor_name || '—'}</td>
    <td>
      <span class="status-pill" style="background:#EDE9FE;color:#5B21B6;">${s.source || '—'}</span>
      <span class="status-pill" style="background:#D1FAE5;color:#065F46;margin-top:2px;">${s.purpose || '—'}</span>
    </td>
    <td class="text-sm">${checkinTime}</td>
    <td class="text-sm"><span data-wait-since="${waitSince}">${formatWaitTime(waitSince)}</span></td>
    <td style="white-space:nowrap;">${actionBtn}</td>
  </tr>`;
}

// ==============================================================================
// TABLE CLICK (event delegation)
// ==============================================================================
async function handleTableClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const bookingId = btn.dataset.bookingId;
  const sessionId = btn.dataset.sessionId;
  const session = _queue.find(s => s.session_id === sessionId);

  if (action === 'start') {
    await startCounseling(bookingId, session);
  } else if (action === 'open') {
    await openPanel(session);
  } else if (action === 'reprint') {
    reprintSlip(sessionId, bookingId);
  }
}

// ==============================================================================
// START COUNSELING
// ==============================================================================
async function startCounseling(bookingId, session) {
  try {
    const result = await api.counselingCheckin(bookingId);
    if (!result.success) { showToast(result.error || 'Failed to start counseling.', 'error'); return; }
    // Update local queue
    const idx = _queue.findIndex(s => s.booking_id === bookingId);
    if (idx !== -1) _queue[idx].counseling_status = 'in_counseling';
    renderStatCards();
    renderTable();
    // Open panel
    await openPanel({ ...session, counseling_status: 'in_counseling', session_id: result.session?.id || session?.session_id });
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ==============================================================================
// PANEL OPEN / CLOSE
// ==============================================================================
async function openPanel(session) {
  _activePanelSession = session;
  _selectedProcs = [];

  // Populate header info
  const name = [session.first_name, session.last_name].filter(Boolean).join(' ') || '—';
  $('cp-patient-info').textContent = `${name} · MR: ${session.patient_mrn || '—'} · ${session.full_phone || '—'}`;
  $('cp-token').textContent   = session.token_number ?? '—';
  $('cp-doctor').textContent  = session.doctor_name || '—';
  $('cp-purpose').textContent = session.purpose || '—';
  renderStatusBadge($('cp-status-badge'), session.counseling_status);

  // Undo visible only for in_counseling + (counselor or admin)
  $('cp-undo-btn').style.display = session.counseling_status === 'in_counseling' ? '' : 'none';
  // Complete button only if not done
  $('cp-complete-btn').disabled = session.counseling_status === 'done';
  $('cp-save-draft-btn').disabled = session.counseling_status === 'done';

  // Load existing session detail (procedures + notes)
  if (session.session_id) {
    try {
      const detail = await api.getCounselingSessionDetail(session.session_id);
      if (detail.success) {
        _selectedProcs = (detail.procedures || []).map(p => ({
          procedure_id: p.procedure_id,
          procedure_name_snapshot: p.procedure_name_snapshot,
          procedure_category_snapshot: p.procedure_category_snapshot,
          quoted_price: parseFloat(p.quoted_price) || 0,
          sort_order: p.sort_order || 0,
        }));
        $('counsel-notes').value = detail.session?.notes || '';
      }
    } catch (err) {
      console.warn('Could not load session detail:', err);
    }
  }

  // Render procedure list and selected list
  renderProcedureList();
  renderSelectedProcs();

  // Show panel
  $('counsel-panel').classList.remove('hidden');
  $('counsel-panel-backdrop').classList.remove('hidden');
}

function closePanel() {
  $('counsel-panel').classList.add('hidden');
  $('counsel-panel-backdrop').classList.add('hidden');
  _activePanelSession = null;
  _selectedProcs = [];
  $('proc-search-input').value = '';
  _procSearchQuery = '';
  $('counsel-notes').value = '';
}

function renderStatusBadge(el, status) {
  const map = {
    waiting:      { label: '⏳ Waiting',       bg: '#FEF3C7', color: '#92400E' },
    in_counseling:{ label: '💬 In Counseling', bg: '#DBEAFE', color: '#1D4ED8' },
    done:         { label: '✅ Done',           bg: '#D1FAE5', color: '#065F46' },
  };
  const s = map[status] || { label: status, bg: '#F3F4F6', color: '#374151' };
  el.textContent = s.label;
  el.style.background = s.bg;
  el.style.color = s.color;
  el.style.padding = '2px 10px';
  el.style.borderRadius = '99px';
  el.style.fontWeight = '600';
  el.style.fontSize = '.75rem';
}

// ==============================================================================
// PROCEDURE LIST IN PANEL
// ==============================================================================
function renderProcedureList() {
  const container = $('proc-list');
  const selectedIds = new Set(_selectedProcs.map(p => p.procedure_id).filter(Boolean));

  // Group by category
  const filtered = _procedures.filter(p => {
    if (!_procSearchQuery) return true;
    return (p.name + ' ' + (p.category || '')).toLowerCase().includes(_procSearchQuery);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-muted" style="padding:12px;text-align:center;">No procedures found.</div>';
    return;
  }

  const categories = [...new Set(filtered.map(p => p.category || 'Other'))];
  container.innerHTML = categories.map(cat => {
    const procs = filtered.filter(p => (p.category || 'Other') === cat);
    return `<div class="proc-category-group">
      <div class="proc-category-label">${cat}</div>
      ${procs.map(p => `
        <label class="proc-checkbox-row ${selectedIds.has(p.id) ? 'checked' : ''}">
          <input type="checkbox" class="proc-checkbox" data-proc-id="${p.id}"
            data-proc-name="${escHtml(p.name)}" data-proc-cat="${escHtml(p.category || '')}"
            ${selectedIds.has(p.id) ? 'checked' : ''} />
          <span class="proc-name">${escHtml(p.name)}</span>
        </label>
      `).join('')}
    </div>`;
  }).join('');

  // Attach change listeners
  container.querySelectorAll('.proc-checkbox').forEach(cb => {
    cb.addEventListener('change', onProcCheckboxChange);
  });
}

function onProcCheckboxChange(e) {
  const cb = e.target;
  const procId   = cb.dataset.procId;
  const procName = cb.dataset.procName;
  const procCat  = cb.dataset.procCat;

  if (cb.checked) {
    // Add to selected with price=0
    if (!_selectedProcs.find(p => p.procedure_id === procId)) {
      _selectedProcs.push({
        procedure_id: procId,
        procedure_name_snapshot: procName,
        procedure_category_snapshot: procCat,
        quoted_price: 0,
        sort_order: _selectedProcs.length,
      });
    }
    cb.closest('label')?.classList.add('checked');
  } else {
    _selectedProcs = _selectedProcs.filter(p => p.procedure_id !== procId);
    cb.closest('label')?.classList.remove('checked');
  }
  renderSelectedProcs();
}

// ==============================================================================
// SELECTED PROCEDURES WITH PRICE INPUTS
// ==============================================================================
function renderSelectedProcs() {
  const container = $('selected-proc-list');
  const totalRow  = $('counsel-total-row');

  if (_selectedProcs.length === 0) {
    container.innerHTML = '<div class="text-muted" style="font-size:.8rem;">No procedures selected yet.</div>';
    totalRow.style.display = 'none';
    return;
  }

  container.innerHTML = _selectedProcs.map((p, i) => `
    <div class="selected-proc-row" data-idx="${i}">
      <span class="selected-proc-name">${escHtml(p.procedure_name_snapshot)}</span>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <span style="color:var(--gray-500);font-size:.8rem;">Rs</span>
        <input type="number" class="proc-price-input" data-idx="${i}"
          value="${p.quoted_price}" min="0" step="1"
          placeholder="0" style="width:90px;" />
        <button class="btn btn--ghost btn--sm proc-remove-btn" data-idx="${i}" title="Remove">✕</button>
      </div>
    </div>
  `).join('');

  // Price inputs
  container.querySelectorAll('.proc-price-input').forEach(input => {
    input.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.idx);
      const val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0) {
        e.target.style.borderColor = 'var(--red)';
      } else {
        e.target.style.borderColor = '';
        _selectedProcs[idx].quoted_price = val;
        updateTotal();
      }
    });
    input.addEventListener('blur', e => {
      const val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0) {
        e.target.value = 0;
        const idx = parseInt(e.target.dataset.idx);
        _selectedProcs[idx].quoted_price = 0;
        e.target.style.borderColor = '';
        updateTotal();
      }
    });
  });

  // Remove buttons
  container.querySelectorAll('.proc-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(btn.dataset.idx);
      const removed = _selectedProcs.splice(idx, 1)[0];
      // Uncheck in procedure list
      if (removed.procedure_id) {
        const cb = $('proc-list')?.querySelector(`[data-proc-id="${removed.procedure_id}"]`);
        if (cb) { cb.checked = false; cb.closest('label')?.classList.remove('checked'); }
      }
      renderSelectedProcs();
    });
  });

  totalRow.style.display = '';
  updateTotal();
}

function updateTotal() {
  const total = _selectedProcs.reduce((sum, p) => sum + (parseFloat(p.quoted_price) || 0), 0);
  $('counsel-total-amount').textContent = `Rs ${total.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ==============================================================================
// SAVE COUNSELING (Draft or Complete)
// ==============================================================================
async function saveCounseling(complete) {
  if (!_activePanelSession) return;

  // Validate prices
  const hasNegative = _selectedProcs.some(p => p.quoted_price < 0);
  if (hasNegative) { showToast('Prices cannot be negative.', 'error'); return; }

  if (complete) {
    const ok = await confirmDialog(
      `Complete counseling for this patient? This will trigger the procedure slip print.`
    );
    if (!ok) return;
  }

  const notes = $('counsel-notes').value.trim();

  try {
    const result = await api.saveCounseling(
      _activePanelSession.booking_id,
      _selectedProcs,
      notes,
      complete
    );
    if (!result.success) { showToast(result.error || 'Failed to save.', 'error'); return; }

    showToast(complete ? 'Counseling completed!' : 'Draft saved.', 'success');

    if (complete) {
      // Update local queue
      const idx = _queue.findIndex(s => s.booking_id === _activePanelSession.booking_id);
      if (idx !== -1) _queue[idx].counseling_status = 'done';
      renderStatCards();
      closePanel();
      // Auto print slip
      openPrintSlip(_activePanelSession.session_id, _activePanelSession.booking_id);
    } else {
      // Update panel status badge
      renderStatusBadge($('cp-status-badge'), _activePanelSession.counseling_status);
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ==============================================================================
// UNDO COUNSELING CHECKIN
// ==============================================================================
async function undoCounselingCheckin() {
  if (!_activePanelSession) return;
  const ok = await confirmDialog('Return patient to Waiting status? The counseling session will reset.');
  if (!ok) return;
  try {
    const result = await api.undoCounselingCheckin(_activePanelSession.booking_id);
    if (!result.success) { showToast(result.error || 'Failed to undo.', 'error'); return; }
    const idx = _queue.findIndex(s => s.booking_id === _activePanelSession.booking_id);
    if (idx !== -1) _queue[idx].counseling_status = 'waiting';
    renderStatCards();
    closePanel();
    renderTable();
    showToast('Patient returned to Waiting.', 'info');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ==============================================================================
// PRINT SLIP
// ==============================================================================
function openPrintSlip(sessionId, bookingId) {
  const url = `./print-slip.html?session_id=${encodeURIComponent(sessionId)}&booking_id=${encodeURIComponent(bookingId)}`;
  window.open(url, '_blank', 'width=500,height=700');
}

function reprintSlip(sessionId, bookingId) {
  const url = `./print-slip.html?session_id=${encodeURIComponent(sessionId)}&booking_id=${encodeURIComponent(bookingId)}&reprint=1`;
  window.open(url, '_blank', 'width=500,height=700');
}

// ==============================================================================
// REALTIME EVENT HANDLER
// ==============================================================================
function onRealtimeEvent(evt) {
  const { event, record, table } = evt;

  // New patient arrived via checkout from reception or new counseling session
  if (
    (event === 'INSERT' && table === 'counseling_sessions') ||
    (event === 'booking_updated' && record?.status === 'checked_out') ||
    (event === 'counseling_change' && record?.status === 'waiting')
  ) {
    refreshQueue();
    showToast('📢 New patient arrived for counseling!', 'info');
    return;
  }

  if (
    (event === 'UPDATE' && table === 'counseling_sessions') ||
    event === 'counseling_change' ||
    event === 'booking_updated'
  ) {
    refreshQueue();
    return;
  }

  if (event === 'tab_visible' || event === 'booking_checkin') {
    refreshQueue();
  }
}

// ==============================================================================
// HELPERS
// ==============================================================================
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ==============================================================================
// BOOT
// ==============================================================================
init().catch(err => {
  console.error('Counseling dashboard init error:', err);
  showToast('Failed to load counseling dashboard.', 'error');
});
