// ==============================================================================
// Clinic Settings Controller
// ==============================================================================
import { requireAuth, logout } from './auth.js';
import { api } from './api.js';
import { showToast, confirmDialog, formatTimestamp } from './utils.js';

// Admin-only page
const user = requireAuth(['admin']);
if (!user) throw new Error('Unauthorized');

const $ = id => document.getElementById(id);

let allDoctors = [];
let allShifts = [];
let allProcedures = [];
let allLookups = [];

async function init() {
  $('hdr-username').textContent = user.full_name || user.username;
  $('logout-btn').addEventListener('click', () => logout());
  $('user-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    $('user-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => $('user-menu')?.classList.remove('open'));

  // Sidebar navigation
  document.querySelectorAll('.settings-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${btn.dataset.tab}`));
      if (btn.dataset.tab === 'audit') loadAuditLogs();
      if (btn.dataset.tab === 'procedures') loadProceduresTable();
    });
  });

  // Clinic form
  $('clinic-form').addEventListener('submit', saveClinicProfile);

  // Doctors
  $('add-doctor-btn').addEventListener('click', () => openDoctorModal());
  $('save-doctor-btn').addEventListener('click', saveDoctor);

  // Shifts
  $('add-shift-btn').addEventListener('click', () => openShiftModal());
  $('save-shift-btn').addEventListener('click', saveShift);

  // Procedures
  $('add-proc-btn').addEventListener('click', () => openProcedureModal());
  $('save-proc-btn').addEventListener('click', saveProcedure);

  // Lookups
  $('lookup-cat-select').addEventListener('change', () => loadLookupsTable());
  $('add-lookup-btn').addEventListener('click', () => openLookupModal());
  $('save-lookup-btn').addEventListener('click', saveLookupItem);

  // Audit
  $('refresh-audit-btn').addEventListener('click', () => loadAuditLogs());

  // Realtime updates for doctors & shifts & procedures
  api.subscribeToRealtime(e => {
    if (e.event === 'doctor_change') {
      loadDoctorsTable();
    } else if (e.event === 'shift_change') {
      loadShiftsTable();
    } else if (e.event === 'procedure_change') {
      loadProceduresTable();
    }
  });

  // Load initial data
  await loadClinicProfile();
  await loadDoctorsTable();
  await loadShiftsTable();
  await loadProceduresTable();
  await loadLookupsTable();
}

// 1. Clinic Profile
async function loadClinicProfile() {
  const c = await api.getClinicInfo();
  $('cfg-name').value      = c.name || '';
  $('cfg-tagline').value   = c.tagline || '';
  $('cfg-phone').value     = c.phone || '';
  $('cfg-emergency').value = c.emergency_phone || '';
  $('cfg-address').value   = c.address || '';
  $('cfg-website').value   = c.website || '';
  if (c.name) $('hdr-clinic-name').textContent = c.name;
}

async function saveClinicProfile(e) {
  e.preventDefault();
  const settings = {
    name: $('cfg-name').value.trim(),
    tagline: $('cfg-tagline').value.trim(),
    phone: $('cfg-phone').value.trim(),
    emergency_phone: $('cfg-emergency').value.trim(),
    address: $('cfg-address').value.trim(),
    website: $('cfg-website').value.trim(),
  };
  try {
    await api.saveClinicInfo(settings);
    $('hdr-clinic-name').textContent = settings.name;
    showToast('Clinic profile saved.', 'success');
  } catch (err) {
    showToast('Failed to save profile: ' + err.message, 'error');
  }
}

// 2. Doctors Table
async function loadDoctorsTable() {
  allDoctors = await api.getAllDoctors();
  const tbody = $('doctors-table').querySelector('tbody');
  tbody.innerHTML = allDoctors.map(d => `
    <tr>
      <td><strong>${d.name}</strong></td>
      <td>${d.specialty}</td>
      <td>${d.phone || '—'}</td>
      <td><span class="badge ${d.is_active ? 'badge--green' : 'badge--gray'}">${d.is_active ? 'Active' : 'Disabled'}</span></td>
      <td>
        <button class="action-btn" title="Edit" data-doc-edit="${d.id}">✏️</button>
        <button class="action-btn action-btn--danger" title="Delete" data-doc-del="${d.id}">🗑</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-doc-edit]').forEach(b => {
    b.addEventListener('click', () => {
      const doc = allDoctors.find(x => x.id === b.dataset.docEdit);
      if (doc) openDoctorModal(doc);
    });
  });

  tbody.querySelectorAll('[data-doc-del]').forEach(b => {
    b.addEventListener('click', async () => {
      const docId = b.dataset.docDel;
      try {
        const futureCount = await api.checkDoctorFutureBookings(docId);
        let msg = 'Deactivate and delete this doctor?';
        if (futureCount > 0) {
          msg = `⚠️ Warning: This doctor has ${futureCount} upcoming booking(s).\nDeleting will deactivate the doctor without breaking existing history. Proceed?`;
        }
        if (confirmDialog(msg)) {
          await api.deleteDoctor(docId);
          showToast('Doctor deleted.', 'success');
          await loadDoctorsTable();
        }
      } catch (err) {
        showToast('Failed to delete doctor: ' + err.message, 'error');
      }
    });
  });
}

function openDoctorModal(doc = null) {
  $('doc-id').value = doc ? doc.id : '';
  $('doc-name').value = doc ? doc.name : '';
  $('doc-specialty').value = doc ? doc.specialty : '';
  $('doc-phone').value = doc ? (doc.phone || '') : '';
  $('doc-avatar').value = doc ? (doc.avatar_url || '') : '';
  $('doc-active').checked = doc ? doc.is_active : true;
  $('doctor-modal-title').textContent = doc ? 'Edit Doctor' : 'Add New Doctor';
  $('doctor-modal').classList.add('open');
}

async function saveDoctor() {
  const name = $('doc-name').value.trim();
  const specialty = $('doc-specialty').value.trim();
  if (!name || !specialty) { showToast('Name and specialty required', 'error'); return; }
  const payload = {
    id: $('doc-id').value || undefined,
    name,
    specialty,
    phone: $('doc-phone').value.trim(),
    avatar_url: $('doc-avatar').value.trim(),
    is_active: $('doc-active').checked,
  };
  try {
    await api.saveDoctor(payload);
    $('doctor-modal').classList.remove('open');
    showToast('Doctor saved.', 'success');
    await loadDoctorsTable();
  } catch (e) {
    showToast('Failed to save doctor: ' + e.message, 'error');
  }
}

// 3. Shifts Table
async function loadShiftsTable() {
  allShifts = await api.getAllShifts();
  const tbody = $('shifts-table').querySelector('tbody');
  tbody.innerHTML = allShifts.map(s => {
    const doc = allDoctors.find(d => d.id === s.doctor_id);
    return `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${doc?.name || '—'}</td>
        <td>${s.start_time}</td>
        <td>${s.end_time}</td>
        <td>${s.slot_duration_minutes} min</td>
        <td><span class="badge ${s.is_active ? 'badge--green' : 'badge--gray'}">${s.is_active ? 'Active' : 'Disabled'}</span></td>
        <td>
          <button class="action-btn" title="Edit" data-shf-edit="${s.id}">✏️</button>
          <button class="action-btn action-btn--danger" title="Delete" data-shf-del="${s.id}">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-shf-edit]').forEach(b => {
    b.addEventListener('click', () => {
      const shf = allShifts.find(x => x.id === b.dataset.shfEdit);
      if (shf) openShiftModal(shf);
    });
  });

  tbody.querySelectorAll('[data-shf-del]').forEach(b => {
    b.addEventListener('click', async () => {
      const shiftId = b.dataset.shfDel;
      try {
        const futureCount = await api.checkShiftFutureBookings(shiftId);
        let msg = 'Delete this shift?';
        if (futureCount > 0) {
          msg = `⚠️ Warning: This shift has ${futureCount} upcoming booking(s).\nDeleting will deactivate the shift without breaking old records. Proceed?`;
        }
        if (confirmDialog(msg)) {
          await api.deleteShift(shiftId);
          showToast('Shift deleted.', 'success');
          await loadShiftsTable();
        }
      } catch (err) {
        showToast('Failed to delete shift: ' + err.message, 'error');
      }
    });
  });
}

function openShiftModal(shf = null) {
  const docSelect = $('shf-doctor');
  docSelect.innerHTML = allDoctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  if (shf) docSelect.value = shf.doctor_id;

  $('shf-id').value = shf ? shf.id : '';
  $('shf-name').value = shf ? shf.name : 'Default Shift';
  $('shf-start').value = shf ? shf.start_time : '08:00';
  $('shf-end').value = shf ? shf.end_time : '22:00';
  $('shf-duration').value = shf ? shf.slot_duration_minutes : 9;
  $('shf-max-walkins').value = shf?.max_walkins ?? 10;
  $('shf-holidays').value = (shf?.holidays || []).join(', ');

  const activeDays = shf?.days_of_week || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  document.querySelectorAll('#shf-days input[type="checkbox"]').forEach(cb => {
    cb.checked = activeDays.includes(cb.value);
  });

  $('shift-modal-title').textContent = shf ? 'Edit Shift' : 'Add New Shift';
  $('shift-modal').classList.add('open');
}

async function saveShift() {
  const name = $('shf-name').value.trim();
  if (!name) { showToast('Shift name is required', 'error'); return; }

  const days_of_week = Array.from(document.querySelectorAll('#shf-days input[type="checkbox"]:checked')).map(cb => cb.value);
  const rawHolidays = $('shf-holidays').value.split(',').map(s => s.trim()).filter(Boolean);

  const payload = {
    id: $('shf-id').value || undefined,
    doctor_id: $('shf-doctor').value,
    name,
    start_time: $('shf-start').value,
    end_time: $('shf-end').value,
    slot_duration_minutes: parseInt($('shf-duration').value, 10) || 9,
    max_walkins: parseInt($('shf-max-walkins').value, 10) || 10,
    days_of_week: days_of_week.length > 0 ? days_of_week : ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    holidays: rawHolidays,
    is_active: true,
  };
  try {
    await api.saveShift(payload);
    $('shift-modal').classList.remove('open');
    showToast('Shift saved.', 'success');
    await loadShiftsTable();
  } catch (e) {
    showToast('Failed to save shift: ' + e.message, 'error');
  }
}

// 4. Procedures Table (Runtime CRUD)
async function loadProceduresTable() {
  allProcedures = await api.getAllProcedures();
  const tbody = $('procedures-table')?.querySelector('tbody');
  if (!tbody) return;
  if (!allProcedures || allProcedures.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:16px;">No procedures configured.</td></tr>';
    return;
  }
  tbody.innerHTML = allProcedures.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge badge--gray">${p.category || 'General'}</span></td>
      <td>${p.sort_order ?? 0}</td>
      <td><span class="badge ${p.is_active ? 'badge--green' : 'badge--gray'}">${p.is_active ? 'Active' : 'Disabled'}</span></td>
      <td>
        <button class="action-btn" title="Edit" data-proc-edit="${p.id}">✏️</button>
        <button class="action-btn action-btn--danger" title="Delete" data-proc-del="${p.id}">🗑</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-proc-edit]').forEach(b => {
    b.addEventListener('click', () => {
      const proc = allProcedures.find(x => x.id === b.dataset.procEdit);
      if (proc) openProcedureModal(proc);
    });
  });

  tbody.querySelectorAll('[data-proc-del]').forEach(b => {
    b.addEventListener('click', async () => {
      const proc = allProcedures.find(x => x.id === b.dataset.procDel);
      if (confirmDialog(`Are you sure you want to delete procedure "${proc?.name || 'Item'}"?`)) {
        try {
          await api.deleteProcedure(b.dataset.procDel);
          showToast('Procedure deleted.', 'success');
          await loadProceduresTable();
        } catch (e) {
          showToast('Failed to delete: ' + e.message, 'error');
        }
      }
    });
  });
}

function openProcedureModal(proc = null) {
  $('proc-edit-id').value = proc?.id || '';
  $('proc-edit-name').value = proc?.name || '';
  $('proc-edit-category').value = proc?.category || '';
  $('proc-edit-order').value = proc?.sort_order ?? (allProcedures.length + 1);
  $('proc-edit-active').value = proc?.is_active === false ? 'false' : 'true';
  $('procedure-modal').classList.add('open');
}

async function saveProcedure() {
  const name = $('proc-edit-name').value.trim();
  if (!name) { showToast('Procedure name is required.', 'error'); return; }
  const payload = {
    id: $('proc-edit-id').value || undefined,
    name,
    category: $('proc-edit-category').value.trim() || null,
    sort_order: parseInt($('proc-edit-order').value, 10) || 0,
    is_active: $('proc-edit-active').value === 'true',
  };
  try {
    await api.saveProcedure(payload);
    $('procedure-modal').classList.remove('open');
    showToast('Procedure saved successfully.', 'success');
    await loadProceduresTable();
  } catch (e) {
    showToast('Failed to save procedure: ' + e.message, 'error');
  }
}

// 5. Lookups Table
async function loadLookupsTable() {
  const cat = $('lookup-cat-select').value;
  allLookups = await api.getLookupsByCategory(cat);
  const tbody = $('lookups-table').querySelector('tbody');
  tbody.innerHTML = allLookups.map(l => `
    <tr>
      <td>
        <strong>${l.name}</strong>
        ${l.requires_counseling ? '<span class="badge badge--blue" style="margin-left:6px;font-size:.7rem;">Counseling Required</span>' : ''}
      </td>
      <td><span class="badge badge--gray">${l.category}</span></td>
      <td>${l.sort_order || 1}</td>
      <td><span class="badge ${l.is_active ? 'badge--green' : 'badge--gray'}">${l.is_active ? 'Active' : 'Disabled'}</span></td>
      <td>
        <button class="action-btn" title="Edit" data-lkp-edit="${l.id}">✏️</button>
        <button class="action-btn action-btn--danger" title="Delete" data-lkp-del="${l.id}">🗑</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-lkp-edit]').forEach(b => {
    b.addEventListener('click', () => {
      const item = allLookups.find(x => x.id === b.dataset.lkpEdit);
      if (item) openLookupModal(item);
    });
  });

  tbody.querySelectorAll('[data-lkp-del]').forEach(b => {
    b.addEventListener('click', async () => {
      if (confirmDialog('Delete this lookup item?')) {
        await api.deleteLookupItem(b.dataset.lkpDel);
        showToast('Item deleted.', 'success');
        loadLookupsTable();
      }
    });
  });
}

function openLookupModal(item = null) {
  $('lkp-id').value = item?.id || '';
  $('lkp-name').value = item?.name || '';
  $('lkp-color').value = item?.color || '#3B82F6';
  const isPurpose = $('lookup-cat-select').value === 'purpose';
  const wrap = $('lkp-counseling-wrap');
  if (wrap) {
    wrap.style.display = isPurpose ? 'block' : 'none';
    $('lkp-requires-counseling').checked = item ? !!item.requires_counseling : (item?.name?.toLowerCase() === 'consultation');
  }
  $('lookup-modal').classList.add('open');
}

async function saveLookupItem() {
  const name = $('lkp-name').value.trim();
  if (!name) { showToast('Name required', 'error'); return; }
  const cat = $('lookup-cat-select').value;
  const payload = {
    id: $('lkp-id').value || undefined,
    category: cat,
    name,
    color: $('lkp-color').value,
    requires_counseling: cat === 'purpose' ? $('lkp-requires-counseling').checked : false,
    is_active: true,
  };
  try {
    await api.saveLookupItem(payload);
    $('lookup-modal').classList.remove('open');
    showToast('Lookup item saved.', 'success');
    await loadLookupsTable();
  } catch (e) {
    showToast('Failed to save item: ' + e.message, 'error');
  }
}

// 6. Audit Log Table
async function loadAuditLogs() {
  const logs = await api.getAuditLogs(100);
  const tbody = $('audit-table').querySelector('tbody');
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td style="font-size:.78rem;color:#6b7280;">${formatTimestamp(l.created_at)}</td>
      <td><strong>${l.username}</strong></td>
      <td><span class="badge badge--gray">${(l.user_role || 'staff').toUpperCase()}</span></td>
      <td><span class="badge badge--blue">${l.action_type}</span></td>
      <td>${l.entity_type} ${l.entity_id ? `(#${l.entity_id.slice(-6)})` : ''}</td>
      <td style="font-size:.75rem;color:#4b5563;font-family:monospace;">${JSON.stringify(l.details_json || {})}</td>
    </tr>
  `).join('');
}

init();

