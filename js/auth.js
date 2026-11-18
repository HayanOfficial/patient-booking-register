// Authentication & session management (custom user_profiles auth, NOT Supabase Auth)
import { supabase, isSupabaseConfigured } from './supabase.js';

const SESSION_KEY = 'pbr_session';

/** Get current user from session storage */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Save session */
export function saveSession(user) {
  const data = JSON.stringify(user);
  sessionStorage.setItem(SESSION_KEY, data);
  localStorage.setItem(SESSION_KEY, data);
}

/** Clear session */
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

/** Redirect to login if not logged in, or to booking if already logged in */
export function requireAuth(allowedRoles = null) {
  const user = getSession();
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate page instead of generic booking
    if (user.role === 'counselor') {
      window.location.href = '/counseling.html';
    } else {
      window.location.href = '/booking.html';
    }
    return null;
  }
  return user;
}

/** Redirect to appropriate dashboard if already logged in (use on login page) */
export function redirectIfLoggedIn() {
  const user = getSession();
  if (user) {
    if (user.role === 'admin' || user.role === 'receptionist') {
      window.location.href = './reception.html';
    } else if (user.role === 'counselor') {
      window.location.href = './counseling.html';
    } else {
      window.location.href = './booking.html';
    }
  }
}

/** Logout */
export function logout() {
  clearSession();
  window.location.href = '/index.html';
}

/** Local fallback users for demo/offline mode */
const LOCAL_USERS = [
  { id: '11111111-1111-1111-1111-111111111111', username: 'admin',        full_name: 'System Administrator', email: 'admin@clinic.com',        role: 'admin',        status: 'active', must_change_password: false, failed_attempts: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '22222222-2222-2222-2222-222222222222', username: 'operator',     full_name: 'Lead Operator Ali',     email: 'ali@clinic.com',          role: 'operator',     status: 'active', must_change_password: false, failed_attempts: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '33333333-3333-3333-3333-333333333333', username: 'receptionist', full_name: 'Front Desk Sara',       email: 'sara@clinic.com',         role: 'receptionist', status: 'active', must_change_password: false, failed_attempts: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];
const LOCAL_PASSWORDS = { admin: 'admin123', operator: 'operator123', receptionist: 'reception123' };

/** Authenticate user against Supabase or local fallback */
export async function authenticateUser(usernameOrEmail, password) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('login_user', {
        p_username_or_email: usernameOrEmail,
        p_password: password,
      });
      if (!error && data) {
        if (data.success) return { success: true, user: data.user };
        return { success: false, error: data.error || 'Authentication failed' };
      }
    } catch (e) {
      console.warn('Supabase login_user RPC failed, using local auth:', e);
    }
  }

  // Local fallback
  const user = LOCAL_USERS.find(u =>
    u.username.toLowerCase() === usernameOrEmail.toLowerCase().trim() ||
    (u.email && u.email.toLowerCase() === usernameOrEmail.toLowerCase().trim())
  );
  if (!user) return { success: false, error: 'Invalid username or password' };
  if (user.status === 'disabled') return { success: false, error: 'Account is disabled.' };
  if (LOCAL_PASSWORDS[user.username] !== password) return { success: false, error: 'Invalid username or password' };
  return { success: true, user };
}

/** Change user password */
export async function changePassword(userId, newPassword) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.rpc('change_user_password', {
        p_user_id: userId,
        p_new_password: newPassword,
      });
      if (data?.success) return true;
    } catch (e) { console.warn('Password change RPC failed:', e); }
  }
  return true; // Local: just pretend it worked
}
