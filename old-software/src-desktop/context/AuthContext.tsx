import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, PermissionKey } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  can: (permission: PermissionKey) => boolean;
  refreshUser: () => Promise<void>;
  dismissMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimeoutMinutesRef = useRef<number>(15);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (user && idleTimeoutMinutesRef.current > 0) {
      idleTimerRef.current = setTimeout(() => {
        console.warn('User idle timeout reached. Auto logging out.');
        logout();
      }, idleTimeoutMinutesRef.current * 60 * 1000);
    }
  }, [user]);

  // Load initial settings and check session
  useEffect(() => {
    const initAuth = async () => {
      try {
        const config = await api.getSecurityConfig();
        if (config?.idle_timeout_minutes) {
          idleTimeoutMinutesRef.current = config.idle_timeout_minutes;
        }
      } catch (err) {
        console.error('Failed to load security config:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // Setup idle listeners
  useEffect(() => {
    if (!user) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetIdleTimer();

    events.forEach((evt) => window.addEventListener(evt, handler));
    resetIdleTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, resetIdleTimer]);

  const login = async (username: string, password: string) => {
    try {
      const res = await api.login({ username, password });
      if (res.success && res.user) {
        setUser(res.user);
        setMustChangePassword(Boolean(res.mustChangePassword));
        return { success: true };
      }
      return { success: false, message: res.message || 'Login failed' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Error during login' };
    }
  };

  const logout = () => {
    if (user) {
      api.logout({ userId: user.id, username: user.username });
    }
    setUser(null);
    setMustChangePassword(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  };

  const can = (permission: PermissionKey): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    // Default receptionist allowed permissions
    const receptionistPermissions: PermissionKey[] = [
      'bookings.view',
      'bookings.create',
      'bookings.edit',
      'bookings.checkin',
      'bookings.status_update',
      'tokens.print',
      'patients.search',
      'patients.create',
      'waiting_list.manage',
      'analytics.daily_cards',
    ];

    if (user.role === 'receptionist') {
      return receptionistPermissions.includes(permission);
    }
    return false;
  };

  const refreshUser = async () => {
    if (!user) return;
    // can re-fetch user if needed
  };

  const dismissMustChangePassword = () => {
    setMustChangePassword(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        mustChangePassword,
        login,
        logout,
        can,
        refreshUser,
        dismissMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
