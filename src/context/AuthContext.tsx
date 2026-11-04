'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserProfile, UserRole, PermissionKey } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  can: (permission: PermissionKey) => boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePassword: (newPassword: string) => Promise<boolean>;
  switchUserRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes idle timeout
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Role permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: [
    'users.manage',
    'settings.manage',
    'reports.view',
    'reports.export',
    'bookings.create',
    'bookings.edit',
    'bookings.delete',
    'bookings.checkin',
    'bookings.status_update',
    'tokens.print',
    'patients.search',
    'patients.create',
    'waiting_list.manage',
    'audit.view',
    'analytics.daily_cards',
  ],
  operator: [
    'bookings.create',
    'bookings.edit',
    'patients.search',
    'patients.create',
    'waiting_list.manage',
  ],
  receptionist: [
    'bookings.create',
    'bookings.edit',
    'bookings.checkin',
    'bookings.status_update',
    'tokens.print',
    'patients.search',
    'patients.create',
    'waiting_list.manage',
    'analytics.daily_cards',
  ],
};

// Initial default user accounts
const INITIAL_USERS: Record<string, { profile: UserProfile; password: string }> = {
  admin: {
    password: 'admin123',
    profile: {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'admin',
      full_name: 'Administrator',
      email: 'admin@drnaeemcenter.com',
      role: 'admin',
      status: 'active',
      must_change_password: false,
      failed_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  operator: {
    password: 'operator123',
    profile: {
      id: '22222222-2222-2222-2222-222222222222',
      username: 'operator',
      full_name: 'Lead Operator Ali',
      email: 'ali.operator@drnaeemcenter.com',
      role: 'operator',
      status: 'active',
      must_change_password: false,
      failed_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  receptionist: {
    password: 'reception123',
    profile: {
      id: '33333333-3333-3333-3333-333333333333',
      username: 'receptionist',
      full_name: 'Front Desk Sara',
      email: 'sara.reception@drnaeemcenter.com',
      role: 'receptionist',
      status: 'active',
      must_change_password: false,
      failed_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  // Restore authenticated session from localStorage on client hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pbr_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.role) {
          setUser(parsed);
          setMustChangePassword(!!parsed.must_change_password);
        }
      }
    } catch (e) {
      console.error('Failed to parse saved session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Idle timeout management
  useEffect(() => {
    if (!user) return;
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  const can = useCallback(
    (permission: PermissionKey): boolean => {
      if (!user) return false;
      const rolePerms = ROLE_PERMISSIONS[user.role] || [];
      return rolePerms.includes(permission);
    },
    [user]
  );

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const waitSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setIsLoading(false);
      return { success: false, error: `Account locked due to repeated failed attempts. Please retry in ${waitSec}s.` };
    }

    try {
      const authResult = await api.authenticateUser(username, password);
      if (!authResult.success || !authResult.user) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
          setIsLoading(false);
          return { success: false, error: 'Maximum login attempts reached. Account locked for 5 minutes.' };
        }
        setIsLoading(false);
        return { success: false, error: authResult.error || 'Invalid username or password' };
      }

      // Successful login
      const profile = authResult.user;
      setFailedAttempts(0);
      setLockoutUntil(null);
      setUser(profile);
      setMustChangePassword(profile.must_change_password);
      try {
        localStorage.setItem('pbr_current_user', JSON.stringify(profile));
      } catch (e) {}

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err?.message || 'Authentication error' };
    }
  };

  const logout = () => {
    setUser(null);
    setMustChangePassword(false);
    try {
      localStorage.removeItem('pbr_current_user');
    } catch (e) {}
  };

  const changePassword = async (newPassword: string): Promise<boolean> => {
    if (!user) return false;
    const ok = await api.changeUserPassword(user.id, newPassword);
    if (ok) {
      const updated = { ...user, must_change_password: false };
      setUser(updated);
      setMustChangePassword(false);
      try {
        localStorage.setItem('pbr_current_user', JSON.stringify(updated));
      } catch (e) {}
      return true;
    }
    return false;
  };

  // Helper for fast role switcher in header
  const switchUserRole = (targetRole: UserRole) => {
    const target = INITIAL_USERS[targetRole];
    if (target) {
      setUser(target.profile);
      setMustChangePassword(target.profile.must_change_password);
      try {
        localStorage.setItem('pbr_current_user', JSON.stringify(target.profile));
      } catch (e) {}
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: !!user,
        isLoading,
        mustChangePassword,
        can,
        login,
        logout,
        changePassword,
        switchUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
