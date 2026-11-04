import {
  User,
  Doctor,
  Shift,
  LookupItem,
  LookupCategory,
  Patient,
  Booking,
  SlotItem,
  WaitingListItem,
  AuditLog,
  DailyStatCardsData,
  ClinicSettings,
  BookingStatus,
} from '../types';

declare global {
  interface Window {
    electronAPI?: any;
  }
}

// Helper wrapper to invoke electronAPI methods safely
export const api = {
  // Auth
  login: async (credentials: { username: string; password: string }) => {
    if (window.electronAPI?.login) return window.electronAPI.login(credentials);
    return { success: false, message: 'Electron bridge not ready' };
  },
  logout: async (payload: { userId: string; username: string }) => {
    if (window.electronAPI?.logout) return window.electronAPI.logout(payload);
    return { success: true };
  },
  changePassword: async (payload: { userId: string; newPassword: string; actorUser: { id: string; username: string } }) => {
    return window.electronAPI?.changePassword(payload);
  },
  resetWithRecoveryKey: async (payload: { recoveryKey: string; newPassword: string }) => {
    return window.electronAPI?.resetWithRecoveryKey(payload);
  },
  getSecurityConfig: async () => {
    return window.electronAPI?.getSecurityConfig();
  },

  // Users
  getAllUsers: async (actorRole: string): Promise<User[]> => {
    return (await window.electronAPI?.getAllUsers({ actorRole })) || [];
  },
  createUser: async (payload: { actorUser: any; data: any }) => {
    return window.electronAPI?.createUser(payload);
  },
  updateUser: async (payload: { actorUser: any; userId: string; updates: any }) => {
    return window.electronAPI?.updateUser(payload);
  },

  // Bookings
  getSlotsForShift: async (payload: { date: string; doctorId: string; shiftId: string }): Promise<{ slots: SlotItem[]; bookings: Booking[] }> => {
    return (await window.electronAPI?.getSlotsForShift(payload)) || { slots: [], bookings: [] };
  },
  quickBook: async (payload: { payload: any; actorUser: any }) => {
    return window.electronAPI?.quickBook(payload);
  },
  updateBookingStatus: async (payload: { bookingId: string; status: BookingStatus; actorUser: any }) => {
    return window.electronAPI?.updateBookingStatus(payload);
  },
  updateBooking: async (payload: { bookingId: string; updates: any; actorUser: any }) => {
    return window.electronAPI?.updateBooking(payload);
  },
  deleteBooking: async (payload: { bookingId: string; actorUser: any }) => {
    return window.electronAPI?.deleteBooking(payload);
  },
  searchBookings: async (query: string): Promise<Booking[]> => {
    return (await window.electronAPI?.searchBookings({ query })) || [];
  },

  // Patients
  searchPatients: async (query: string): Promise<Patient[]> => {
    return (await window.electronAPI?.searchPatients({ query })) || [];
  },
  getPatientHistory: async (patientId: string): Promise<Booking[]> => {
    return (await window.electronAPI?.getPatientHistory({ patientId })) || [];
  },

  // Waiting List
  getWaitingList: async (payload: { date: string; doctorId?: string; shiftId?: string }): Promise<WaitingListItem[]> => {
    return (await window.electronAPI?.getWaitingList(payload)) || [];
  },
  addWaitingList: async (payload: { item: any; actorUser: any }) => {
    return window.electronAPI?.addWaitingList(payload);
  },
  deleteWaitingList: async (payload: { id: string; actorUser: any }) => {
    return window.electronAPI?.deleteWaitingList(payload);
  },

  // Analytics & Reports
  getDailyStats: async (payload: { date: string; doctorId: string; shiftId: string }): Promise<DailyStatCardsData> => {
    return window.electronAPI?.getDailyStats(payload);
  },
  getFullAnalyticsReport: async (payload: { startDate: string; endDate: string; doctorId?: string; actorRole: string }) => {
    return window.electronAPI?.getFullAnalyticsReport(payload);
  },
  getMonthlyPatientReport: async (payload: {
    year: number;
    month: number;
    doctorId?: string;
    shiftId?: string;
    status?: string;
  }) => {
    return window.electronAPI?.getMonthlyPatientReport(payload);
  },

  // Settings
  getClinicInfo: async (): Promise<ClinicSettings> => {
    return window.electronAPI?.getClinicInfo();
  },
  updateClinicInfo: async (payload: { info: ClinicSettings; actorUser: any }) => {
    return window.electronAPI?.updateClinicInfo(payload);
  },
  getLookups: async (category: LookupCategory, onlyActive: boolean = false): Promise<LookupItem[]> => {
    return (await window.electronAPI?.getLookups({ category, onlyActive })) || [];
  },
  getAreas: async (cityId: string, onlyActive: boolean = false): Promise<LookupItem[]> => {
    return (await window.electronAPI?.getAreas({ cityId, onlyActive })) || [];
  },
  createLookup: async (payload: { item: any; actorUser: any }) => {
    return window.electronAPI?.createLookup(payload);
  },
  updateLookup: async (payload: { id: string; updates: any; actorUser: any }) => {
    return window.electronAPI?.updateLookup(payload);
  },
  deleteLookup: async (payload: { id: string; actorUser: any }) => {
    return window.electronAPI?.deleteLookup(payload);
  },
  getDoctors: async (): Promise<Doctor[]> => {
    return (await window.electronAPI?.getDoctors()) || [];
  },
  getActiveDoctors: async (): Promise<Doctor[]> => {
    return (await window.electronAPI?.getActiveDoctors()) || [];
  },
  createDoctor: async (payload: { doc: any; actorUser: any }) => {
    return window.electronAPI?.createDoctor(payload);
  },
  updateDoctor: async (payload: { id: string; updates: any; actorUser: any }) => {
    return window.electronAPI?.updateDoctor(payload);
  },
  deleteDoctor: async (payload: { id: string; actorUser: any }) => {
    return window.electronAPI?.deleteDoctor(payload);
  },
  getShifts: async (doctorId: string): Promise<Shift[]> => {
    return (await window.electronAPI?.getShifts({ doctorId })) || [];
  },
  createShift: async (payload: { shift: any; actorUser: any }) => {
    return window.electronAPI?.createShift(payload);
  },
  updateShift: async (payload: { id: string; updates: any; actorUser: any }) => {
    return window.electronAPI?.updateShift(payload);
  },
  deleteShift: async (payload: { id: string; actorUser: any }) => {
    return window.electronAPI?.deleteShift(payload);
  },

  // Audit
  getRecentAuditLogs: async (payload: { limit: number; actorRole: string }): Promise<AuditLog[]> => {
    return (await window.electronAPI?.getRecentAuditLogs(payload)) || [];
  },

  // Backup
  listBackups: async (actorRole: string) => {
    return (await window.electronAPI?.listBackups({ actorRole })) || [];
  },
  createBackup: async (actorUser: any) => {
    return window.electronAPI?.createBackup({ actorUser });
  },
  restoreBackup: async (payload: { backupPath: string; actorUser: any }) => {
    return window.electronAPI?.restoreBackup(payload);
  },
};
