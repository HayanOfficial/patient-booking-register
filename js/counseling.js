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
let _queue          = [];   // all counseling sessions for today
let _procedures     = [];   // active procedures from DB
let _activeTab      = 'waiting';
let _searchQuery    = '';
let _doctorFilter   = '';
let _modal          = null; // { session, selectedProcs }
let _procSearch     = '';
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

  // Load procedures (for the modal)
  _procedures = await api.getActiveProcedures();

  // Load initial queue
  await refreshQueue();

  // Wire tabs
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

  // Event delegation for table actions
  $('counseling-tbody').addEventListener('click', handleTableClick);

  // Modal wire-up
  wireModal();

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
  $('tab-badge-waiting').textContent       = waiting;
  $('tab-badge-in_counseling').textContent = active;
  $('tab-badge-done').textContent          = done;
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
  const rows  = getFilteredQueue();
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
  const name        = [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
  const phone       = s.full_phone || '—';
  const mrn         = s.patient_mrn || '—';
  const age         = s.age ? `${s.age}y` : '';
  const checkinTime = s.check_in_time ? formatTimestamp(s.check_in_time, 'time') : '—';
  const waitSince   = s.check_in_time || s.created_at;

  let actionBtn = '';
  if (s.counseling_status === 'waiting') {
    actionBtn = `<button class="btn btn--primary btn--sm" data-action="start" data-booking-id="${s.booking_id}" data-session-id="${s.session_id}">
      💬 Start Counseling
    </button>`;
  } else if (s.counseling_status === 'in_counseling') {
    actionBtn = `<button class="btn btn--warning btn--sm" data-action="open" data-booking-id="${s.booking_id}" data-session-id="${s.session_id}">
      📝 Continue
    </button>`;
  } else {
    actionBtn = `
      <button class="btn btn--ghost btn--sm" data-action="open" data-booking-id="${s.booking_id}" data-session-id="${s.session_id}">👁 View</button>
      <button class="btn btn--ghost btn--sm" data-action="reprint" data-booking-id="${s.booking_id}" data-session-id="${s.session_id}" title="Reprint Slip">🖨️</button>`;
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
      <span class="status-pill" style="background:#EDE9FE;color:#5B21B6;">${escHtml(s.source || '—')}</span>
      <span class="status-pill" style="background:#D1FAE5;color:#065F46;margin-top:2px;">${escHtml(s.purpose || '—')}</span>
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
  const action    = btn.dataset.action;
  const bookingId = btn.dataset.bookingId;
  const sessionId = btn.dataset.sessionId;
  const session   = _queue.find(s => s.session_id === sessionId);

  if (action === 'start') {
    await startCounseling(bookingId, session);
  } else if (action === 'open') {
    await openModal(session);
  } else if (action === 'reprint') {
    reprintSlip(sessionId, bookingId);
  }
}

// ==============================================================================
// START COUNSELING — calls RPC, then opens modal
// ==============================================================================
async function startCounseling(bookingId, session) {
  try {
    const result = await api.counselingCheckin(bookingId);
    if (!result.success) { showToast(result.error || 'Failed to start counseling.', 'error'); return; }
    // Update local queue immediately
    const idx = _queue.findIndex(s => s.booking_id === bookingId);
    if (idx !== -1) _queue[idx].counseling_status = 'in_counseling';
    renderStatCards();
    renderTable();
    // Open modal with updated session object
    const updated = { ...session, counseling_status: 'in_counseling', session_id: result.session?.id || session?.session_id };
    await openModal(updated);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ==============================================================================
// MODAL WIRE-UP
// ==============================================================================
function wireModal() {
  $('cm-close-btn').addEventListener('click', closeModal);
  // Close on overlay click outside the modal
  $('counsel-modal-overlay').addEventListener('click', e => {
    if (e.target === $('counsel-modal-overlay')) closeModal();
  });
  $('cm-draft-btn').addEventListener('click', () => saveCounseling(false));
  $('cm-complete-btn').addEventListener('click', () => saveCounseling(true));
  $('cm-undo-btn').addEventListener('click', undoCounselingCheckin);

  // Procedure search
  const doProcSearch = debounce(() => {
    _procSearch = $('cm-proc-search').value.trim().toLowerCase();
    renderProcPicker();
  }, 200);
  $('cm-proc-search').addEventListener('input', doProcSearch);

  // Custom procedure add
  $('cm-add-custom-btn').addEventListener('click', addCustomProcedure);
  $('cm-custom-proc-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomProcedure(); }
  });

  // Event delegation for selected procedure price/remove
  $('cm-selected-scroll').addEventListener('input', e => {
    const inp = e.target.closest('.proc-price-input');
    if (!inp || !_modal) return;
    const idx = parseInt(inp.dataset.idx);
    const val = parseFloat(inp.value);
    if (isNaN(val) || val < 0) {
      inp.classList.add('error');
    } else {
      inp.classList.remove('error');
      _modal.selectedProcs[idx].quoted_price = parseFloat(val.toFixed(2));
      updateTotal();
    }
  });
  $('cm-selected-scroll').addEventListener('blur', e => {
    const inp = e.target.closest('.proc-price-input');
    if (!inp || !_modal) return;
    const val = parseFloat(inp.value);
    if (isNaN(val) || val < 0) {
      inp.value = '0.00';
      const idx = parseInt(inp.dataset.idx);
      _modal.selectedProcs[idx].quoted_price = 0;
      inp.classList.remove('error');
      updateTotal();
    }
  }, true);
  $('cm-selected-scroll').addEventListener('click', e => {
    const btn = e.target.closest('.proc-remove-btn');
    if (!btn || !_modal) return;
    const idx     = parseInt(btn.dataset.idx);
    const removed = _modal.selectedProcs.splice(idx, 1)[0];
    // Uncheck in picker if it was from DB
    if (removed.procedure_id) {
      const cb = $('cm-proc-scroll')?.querySelector(`[data-proc-id="${removed.procedure_id}"]`);
      if (cb) { cb.checked = false; cb.closest('label')?.classList.remove('checked'); }
    }
    _modal.selectedProcs.forEach((p, i) => p.sort_order = i);
    renderSelectedProcs();
  });
}

// ==============================================================================
// OPEN MODAL
// ==============================================================================
async function openModal(session) {
  _modal = { session, selectedProcs: [] };

  // --- Fill header ---
  const name = [session.first_name, session.last_name].filter(Boolean).join(' ') || '—';
  $('counsel-modal-title').textContent   = 'Counseling Session';
  $('cm-patient-subtitle').textContent   = name;
  $('cm-token').textContent   = session.token_number ?? '—';
  $('cm-doctor').textContent  = session.doctor_name   || '—';
  $('cm-mrn').textContent     = session.patient_mrn   || '—';
  $('cm-age').textContent     = session.age ? session.age + ' yrs' : '—';
  $('cm-phone').textContent   = session.full_phone     || '—';
  $('cm-source').textContent  = session.source         || '—';
  renderStatusChip($('cm-status-chip'), session.counseling_status);

  // Undo only for in_counseling
  $('cm-undo-btn').style.display   = session.counseling_status === 'in_counseling' ? '' : 'none';
  $('cm-complete-btn').disabled    = session.counseling_status === 'done';
  $('cm-draft-btn').disabled       = session.counseling_status === 'done';

  hideError();

  // --- Load saved draft (procedures + notes) ---
  if (session.session_id) {
    try {
      const detail = await api.getCounselingSessionDetail(session.session_id);
      if (detail.success) {
        _modal.selectedProcs = (detail.procedures || []).map((p, i) => ({
          procedure_id: p.procedure_id || null,
          procedure_name_snapshot: p.procedure_name_snapshot,
          procedure_category_snapshot: p.procedure_category_snapshot || null,
          quoted_price: parseFloat(p.quoted_price) || 0,
          sort_order: p.sort_order ?? i,
        }));
        $('cm-notes').value = detail.session?.notes || '';
      }
    } catch (err) {
      console.warn('Could not load session detail:', err);
    }
  } else {
    $('cm-notes').value = '';
  }

  // Reset search
  $('cm-proc-search').value  = '';
  $('cm-custom-proc-name').value = '';
  _procSearch = '';

  renderProcPicker();
  renderSelectedProcs();

  $('counsel-modal-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('counsel-modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  _modal = null;
  $('cm-notes').value = '';
  $('cm-proc-search').value = '';
  $('cm-custom-proc-name').value = '';
  _procSearch = '';
  hideError();
}

// ==============================================================================
// PROCEDURE PICKER (left pane)
// ==============================================================================
function renderProcPicker() {
  if (!_modal) return;
  const container   = $('cm-proc-scroll');
  const selectedIds = new Set(_modal.selectedProcs.map(p => p.procedure_id).filter(Boolean));

  const filtered = _procedures.filter(p => {
    if (!_procSearch) return true;
    return (p.name + ' ' + (p.category || '')).toLowerCase().includes(_procSearch);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="counsel-empty-msg">No procedures match your search.</div>';
    return;
  }

  const categories = [...new Set(filtered.map(p => p.category || 'Other'))];
  container.innerHTML = categories.map(cat => {
    const procs = filtered.filter(p => (p.category || 'Other') === cat);
    return `<div class="proc-category-group">
      <div class="proc-category-label">${escHtml(cat)}</div>
      ${procs.map(p => `
        <label class="proc-checkbox-row ${selectedIds.has(p.id) ? 'checked' : ''}">
          <input type="checkbox" class="proc-checkbox" data-proc-id="${p.id}"
            data-proc-name="${escAttr(p.name)}" data-proc-cat="${escAttr(p.category || '')}"
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
  if (!_modal) return;
  const cb       = e.target;
  const procId   = cb.dataset.procId;
  const procName = cb.dataset.procName;
  const procCat  = cb.dataset.procCat;

  if (cb.checked) {
    if (!_modal.selectedProcs.find(p => p.procedure_id === procId)) {
      _modal.selectedProcs.push({
        procedure_id: procId,
        procedure_name_snapshot: procName,
        procedure_category_snapshot: procCat,
        quoted_price: 0,
        sort_order: _modal.selectedProcs.length,
      });
    }
    cb.closest('label')?.classList.add('checked');
  } else {
    _modal.selectedProcs = _modal.selectedProcs.filter(p => p.procedure_id !== procId);
    _modal.selectedProcs.forEach((p, i) => p.sort_order = i);
    cb.closest('label')?.classList.remove('checked');
  }
  renderSelectedProcs();
}

// ==============================================================================
// CUSTOM PROCEDURE ADD
// ==============================================================================
function addCustomProcedure() {
  if (!_modal) return;
  const input = $('cm-custom-proc-name');
  const name  = input.value.trim();
  if (!name) { input.focus(); return; }
  // Avoid duplicate custom names (case-insensitive)
  const dup = _modal.selectedProcs.find(p => p.procedure_name_snapshot.toLowerCase() === name.toLowerCase());
  if (dup) {
    showError('This procedure is already in the list.');
    return;
  }
  _modal.selectedProcs.push({
    procedure_id: null, // custom = no DB id
    procedure_name_snapshot: name,
    procedure_category_snapshot: 'Custom',
    quoted_price: 0,
    sort_order: _modal.selectedProcs.length,
  });
  input.value = '';
  hideError();
  renderSelectedProcs();
  // Scroll selected pane to bottom
  const scroll = $('cm-selected-scroll');
  scroll.scrollTop = scroll.scrollHeight;
}

// ==============================================================================
// SELECTED PROCEDURES (right pane)
// ==============================================================================
function renderSelectedProcs() {
  if (!_modal) return;
  const scroll   = $('cm-selected-scroll');
  const emptyMsg = $('cm-empty-msg');
  const totalWrap= $('cm-total-wrap');

  if (_modal.selectedProcs.length === 0) {
    // Keep empty msg visible inside the scroll, nothing else
    scroll.innerHTML = '<div class="counsel-empty-msg" id="cm-empty-msg">No procedures added yet. Select from the list or add a custom one.</div>';
    totalWrap.style.display = 'none';
    return;
  }

  scroll.innerHTML = _modal.selectedProcs.map((p, i) => `
    <div class="selected-proc-row" data-idx="${i}">
      <span class="selected-proc-name">${escHtml(p.procedure_name_snapshot)}
        ${p.procedure_category_snapshot ? `<span style="display:block;font-size:.68rem;color:#9ca3af;">${escHtml(p.procedure_category_snapshot)}</span>` : ''}
      </span>
      <div class="proc-price-wrap">
        <span>Rs</span>
        <input type="number" class="proc-price-input"
          data-idx="${i}" value="${p.quoted_price.toFixed(2)}"
          min="0" step="1" placeholder="0" />
        <button class="proc-remove-btn" data-idx="${i}" title="Remove">✕</button>
      </div>
    </div>
  `).join('');

  totalWrap.style.display = '';
  updateTotal();
}

function updateTotal() {
  if (!_modal) return;
  const total = _modal.selectedProcs.reduce((sum, p) => sum + (parseFloat(p.quoted_price) || 0), 0);
  $('cm-total-amount').textContent = `Rs ${total.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ==============================================================================
// STATUS CHIP
// ==============================================================================
function renderStatusChip(el, status) {
  const map = {
    waiting:      { label: '⏳ Waiting',       bg: '#fef3c7', color: '#92400e' },
    in_counseling:{ label: '💬 In Counseling', bg: '#dbeafe', color: '#1d4ed8' },
    done:         { label: '✅ Done',           bg: '#d1fae5', color: '#065f46' },
  };
  const s = map[status] || { label: status, bg: '#f3f4f6', color: '#374151' };
  el.textContent          = s.label;
  el.style.background     = s.bg;
  el.style.color          = s.color;
  el.style.fontWeight     = '700';
}

// ==============================================================================
// ERROR BANNER
// ==============================================================================
function showError(msg) {
  const el = $('cm-error-banner');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hideError() {
  $('cm-error-banner').classList.add('hidden');
  $('cm-error-banner').textContent = '';
}

// ==============================================================================
// SAVE COUNSELING (Draft or Complete)
// ==============================================================================
async function saveCounseling(complete) {
  if (!_modal) return;
  hideError();

  // --- Validation ---
  if (complete) {
    if (_modal.selectedProcs.length === 0) {
      showError('Please add at least one procedure before completing.');
      return;
    }
    const missingPrice = _modal.selectedProcs.find(p => {
      const v = parseFloat(p.quoted_price);
      return isNaN(v) || v < 0;
    });
    if (missingPrice) {
      showError(`Enter a valid price (≥ 0) for: "${missingPrice.procedure_name_snapshot}"`);
      return;
    }
    const hasNegative = _modal.selectedProcs.some(p => parseFloat(p.quoted_price) < 0);
    if (hasNegative) {
      showError('Prices cannot be negative.');
      return;
    }
  }

  if (complete) {
    const ok = await confirmDialog('Mark this patient as Procedure Done and print the token slip?');
    if (!ok) return;
  }

  const notes   = $('cm-notes').value.trim();
  const session = _modal.session;

  // Freeze ref before async call (modal may close)
  const frozenBookingId  = session.booking_id;
  const frozenSessionId  = session.session_id;

  try {
    const result = await api.saveCounseling(frozenBookingId, _modal.selectedProcs, notes, complete);
    if (!result.success) { showError(result.error || 'Failed to save.'); return; }

    showToast(complete ? 'Counseling completed & slip printing…' : 'Draft saved.', 'success');

    if (complete) {
      // Update local queue
      const idx = _queue.findIndex(s => s.booking_id === frozenBookingId);
      if (idx !== -1) _queue[idx].counseling_status = 'done';
      renderStatCards();
      renderTable();
      closeModal();
      // Open print slip
      openPrintSlip(frozenSessionId, frozenBookingId);
    } else {
      showToast('Draft saved — panel stays open.', 'info');
    }
  } catch (err) {
    showError('Error: ' + err.message);
  }
}

// ==============================================================================
// UNDO COUNSELING CHECKIN
// ==============================================================================
async function undoCounselingCheckin() {
  if (!_modal) return;
  const ok = await confirmDialog('Return patient to Waiting status? The counseling session will reset.');
  if (!ok) return;
  const bookingId = _modal.session.booking_id;
  try {
    const result = await api.undoCounselingCheckin(bookingId);
    if (!result.success) { showToast(result.error || 'Failed to undo.', 'error'); return; }
    const idx = _queue.findIndex(s => s.booking_id === bookingId);
    if (idx !== -1) _queue[idx].counseling_status = 'waiting';
    renderStatCards();
    closeModal();
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
  window.open(url, '_blank', 'width=560,height=750');
}

function reprintSlip(sessionId, bookingId) {
  const url = `./print-slip.html?session_id=${encodeURIComponent(sessionId)}&booking_id=${encodeURIComponent(bookingId)}&reprint=1`;
  window.open(url, '_blank', 'width=560,height=750');
}

// ==============================================================================
// REALTIME EVENT HANDLER
// ==============================================================================
function onRealtimeEvent(evt) {
  const { event, record, table } = evt;

  // New patient checked out at reception → arrives in Counseling Waiting
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
function escAttr(str) {
  return String(str ?? '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ==============================================================================
// BOOT
// ==============================================================================
init().catch(err => {
  console.error('Counseling dashboard init error:', err);
  showToast('Failed to load counseling dashboard.', 'error');
});
