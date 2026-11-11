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

  // Lookups
  $('lookup-cat-select').addEventListener('change', () => loadLookupsTable());
  $('add-lookup-btn').addEventListener('click', () => openLookupModal());
  $('save-lookup-btn').addEventListener('click', saveLookupItem);

  // Audit
  $('refresh-audit-btn').addEventListener('click', () => loadAuditLogs());

  // Load initial data
  await loadClinicProfile();
  await loadDoctorsTable();
  await loadShiftsTable();
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
      if (confirmDialog('Deactivate this doctor?')) {
        await api.deleteDoctor(b.dataset.docDel);
        showToast('Doctor deleted.', 'success');
        loadDoctorsTable();
      }
    });
  });
}

function openDoctorModal(doc = null) {
  $('doc-id').value = doc ? doc.id : '';
  $('doc-name').value = doc ? doc.name : '';
  $('doc-specialty').value = doc ? doc.specialty : '';
  $('doc-phone').value = doc ? (doc.phone || '') : '';
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
  $('shift-modal-title').textContent = shf ? 'Edit Shift' : 'Add New Shift';
  $('shift-modal').classList.add('open');
}

async function saveShift() {
  const name = $('shf-name').value.trim();
  if (!name) { showToast('Shift name is required', 'error'); return; }
  const payload = {
    id: $('shf-id').value || undefined,
    doctor_id: $('shf-doctor').value,
    name,
    start_time: $('shf-start').value,
    end_time: $('shf-end').value,
    slot_duration_minutes: parseInt($('shf-duration').value, 10) || 9,
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

// 4. Lookups Table
async function loadLookupsTable() {
  const cat = $('lookup-cat-select').value;
  allLookups = await api.getLookupsByCategory(cat);
  const tbody = $('lookups-table').querySelector('tbody');
  tbody.innerHTML = allLookups.map(l => `
    <tr>
      <td><strong>${l.name}</strong></td>
      <td><span class="badge badge--gray">${l.category}</span></td>
      <td>${l.sort_order || 1}</td>
      <td><span class="badge ${l.is_active ? 'badge--green' : 'badge--gray'}">${l.is_active ? 'Active' : 'Disabled'}</span></td>
      <td>
        <button class="action-btn action-btn--danger" title="Delete" data-lkp-del="${l.id}">🗑</button>
      </td>
    </tr>
  `).join('');

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

function openLookupModal() {
  $('lkp-id').value = '';
  $('lkp-name').value = '';
  $('lookup-modal').classList.add('open');
}

async function saveLookupItem() {
  const name = $('lkp-name').value.trim();
  if (!name) { showToast('Name required', 'error'); return; }
  const payload = {
    category: $('lookup-cat-select').value,
    name,
    color: $('lkp-color').value,
    is_active: true,
  };
  try {
    await api.saveLookupItem(payload);
    $('lookup-modal').classList.remove('open');
    showToast('Lookup item added.', 'success');
    await loadLookupsTable();
  } catch (e) {
    showToast('Failed to save item: ' + e.message, 'error');
  }
}

// 5. Audit Log Table
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

