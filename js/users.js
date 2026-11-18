// ==============================================================================
// Staff User Management Controller
// ==============================================================================
import { requireAuth, logout } from './auth.js';
import { api } from './api.js';
import { showToast, confirmDialog } from './utils.js';

// Admin-only protection
const currentUser = requireAuth(['admin']);
if (!currentUser) throw new Error('Unauthorized');

const $ = id => document.getElementById(id);

let allUsers = [];

async function init() {
  $('hdr-username').textContent = currentUser.full_name || currentUser.username;
  try {
    const c = await api.getClinicInfo();
    if (c?.name) $('hdr-clinic-name').textContent = c.name;
  } catch (err) {
    console.warn('Clinic info fetch failed:', err);
  }

  $('logout-btn').addEventListener('click', () => logout());
  $('user-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    $('user-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => $('user-menu')?.classList.remove('open'));

  $('add-user-btn').addEventListener('click', () => openCreateModal());
  $('save-user-btn').addEventListener('click', saveUser);
  $('confirm-reset-btn').addEventListener('click', confirmResetPassword);

  await loadUsers();
}

async function loadUsers() {
  $('users-tbody').innerHTML = '<tr class="loading-row"><td colspan="7"><span class="spinner"></span> Loading staff accounts...</td></tr>';
  try {
    allUsers = await api.getUsers();
    renderUsersTable();
  } catch (e) {
    $('users-tbody').innerHTML = `<tr class="empty-row"><td colspan="7">Failed to load users: ${e.message}</td></tr>`;
  }
}

function renderUsersTable() {
  const tbody = $('users-tbody');
  if (!allUsers.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No staff users registered.</td></tr>';
    return;
  }

  tbody.innerHTML = allUsers.map(u => {
    const roleBadge = u.role === 'admin' ? 'badge--amber' : u.role === 'receptionist' ? 'badge--green' : u.role === 'counselor' ? 'badge--teal' : 'badge--blue';
    const statusBadge = u.status === 'active' ? 'badge--green' : 'badge--red';
    const isSelf = u.id === currentUser.id;

    return `
      <tr>
        <td><strong>${u.full_name}</strong> ${isSelf ? '<span class="badge badge--gray">(You)</span>' : ''}</td>
        <td><code>${u.username}</code></td>
        <td><span class="badge ${roleBadge}">${u.role.toUpperCase()}</span></td>
        <td>${u.email || '—'}</td>
        <td><span class="badge ${statusBadge}">${u.status.toUpperCase()}</span></td>
        <td>${u.must_change_password ? '<span class="badge badge--amber">Required</span>' : '<span style="color:#10b981;">No</span>'}</td>
        <td>
          <button class="action-btn" title="Edit" data-uid="${u.id}" data-action="edit">✏️</button>
          <button class="action-btn" title="Reset Password" data-uid="${u.id}" data-action="reset">🔑</button>
          ${!isSelf ? `<button class="action-btn action-btn--danger" title="Disable/Delete" data-uid="${u.id}" data-action="delete">🗑</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = allUsers.find(x => x.id === btn.dataset.uid);
      if (!u) return;
      if (btn.dataset.action === 'edit') openEditModal(u);
      else if (btn.dataset.action === 'reset') openResetModal(u);
      else if (btn.dataset.action === 'delete') deleteStaffUser(u);
    });
  });
}

function openCreateModal() {
  $('u-id').value = '';
  $('u-fullname').value = '';
  $('u-username').value = '';
  $('u-username').disabled = false;
  $('u-role').value = 'operator';
  $('u-email').value = '';
  $('u-password').value = '';
  $('pwd-field-group').style.display = 'block';
  $('u-status').value = 'active';
  $('u-error').classList.add('hidden');
  $('user-modal-title').textContent = 'Create New Staff User';
  $('user-modal').classList.add('open');
}

function openEditModal(user) {
  $('u-id').value = user.id;
  $('u-fullname').value = user.full_name;
  $('u-username').value = user.username;
  $('u-username').disabled = true; // username locked
  $('u-role').value = user.role;
  $('u-email').value = user.email || '';
  $('pwd-field-group').style.display = 'none'; // password handled via reset
  $('u-status').value = user.status;
  $('u-error').classList.add('hidden');
  $('user-modal-title').textContent = `Edit User: ${user.username}`;
  $('user-modal').classList.add('open');
}

async function saveUser() {
  const errEl = $('u-error');
  errEl.classList.add('hidden');

  const id = $('u-id').value;
  const fullName = $('u-fullname').value.trim();
  const username = $('u-username').value.trim();
  const role     = $('u-role').value;
  const email    = $('u-email').value.trim();
  const status   = $('u-status').value;
  const password = $('u-password').value;

  if (!fullName || !username) {
    errEl.textContent = 'Full name and username are required.';
    errEl.classList.remove('hidden');
    return;
  }

  if (!id && password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.classList.remove('hidden');
    return;
  }

  // Prevent demoting last active admin
  if (id) {
    const existing = allUsers.find(u => u.id === id);
    if (existing?.role === 'admin' && (role !== 'admin' || status === 'disabled')) {
      const activeAdmins = allUsers.filter(u => u.role === 'admin' && u.status === 'active' && u.id !== id);
      if (activeAdmins.length === 0) {
        errEl.textContent = 'The last active Administrator cannot be demoted or disabled.';
        errEl.classList.remove('hidden');
        return;
      }
    }
  }

  // Attempt serverless /api first if available, else standard fallback
  try {
    if (!id) {
      // Call create-user API
      try {
        const resp = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, username, role, email, password, callerRole: currentUser.role })
        });
        if (resp.ok) {
          const res = await resp.json();
          if (res.user) {
            $('user-modal').classList.remove('open');
            showToast('User created successfully.', 'success');
            await loadUsers();
            return;
          }
        }
      } catch (err) {
        console.warn('/api/create-user fetch failed, falling back to direct save:', err);
      }
    }

    // Direct save
    await api.saveUser({
      id: id || undefined,
      full_name: fullName,
      username,
      role,
      email: email || null,
      status,
    });

    $('user-modal').classList.remove('open');
    showToast('User saved successfully.', 'success');
    await loadUsers();
  } catch (e) {
    errEl.textContent = e.message || 'Failed to save user.';
    errEl.classList.remove('hidden');
  }
}

function openResetModal(user) {
  $('reset-uid').value = user.id;
  $('reset-user-text').textContent = `Resetting password for ${user.full_name} (@${user.username})`;
  $('reset-new-pwd').value = '';
  $('reset-error').classList.add('hidden');
  $('reset-modal').classList.add('open');
}

async function confirmResetPassword() {
  const uid = $('reset-uid').value;
  const np  = $('reset-new-pwd').value;
  const errEl = $('reset-error');
  errEl.classList.add('hidden');

  if (np.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    // Try serverless API first
    try {
      const resp = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, newPassword: np, callerRole: currentUser.role })
      });
      if (resp.ok) {
        $('reset-modal').classList.remove('open');
        showToast('Password reset successfully.', 'success');
        return;
      }
    } catch (err) {
      console.warn('/api/reset-password fetch failed, falling back to direct RPC:', err);
    }

    await api.changeUserPassword(uid, np);
    $('reset-modal').classList.remove('open');
    showToast('Password reset successfully.', 'success');
  } catch (e) {
    errEl.textContent = e.message || 'Failed to reset password.';
    errEl.classList.remove('hidden');
  }
}

async function deleteStaffUser(user) {
  if (user.role === 'admin') {
    const activeAdmins = allUsers.filter(u => u.role === 'admin' && u.status === 'active' && u.id !== user.id);
    if (activeAdmins.length === 0) {
      showToast('Cannot delete the last active administrator.', 'error');
      return;
    }
  }

  if (!confirmDialog(`Deactivate and delete user account for ${user.full_name} (@${user.username})?`)) return;

  try {
    try {
      const resp = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, callerRole: currentUser.role })
      });
      if (resp.ok) {
        showToast('User account deactivated.', 'success');
        await loadUsers();
        return;
      }
    } catch (err) {
      console.warn('/api/delete-user fetch failed, using direct delete:', err);
    }

    await api.deleteUser(user.id);
    showToast('User account deactivated.', 'success');
    await loadUsers();
  } catch (e) {
    showToast('Failed to delete user: ' + e.message, 'error');
  }
}

init();

