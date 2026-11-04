import { contextBridge, ipcRenderer } from 'electron';

export const electronAPI = {
  // Auth
  login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
  logout: (payload: any) => ipcRenderer.invoke('auth:logout', payload),
  changePassword: (payload: any) => ipcRenderer.invoke('auth:changePassword', payload),
  resetWithRecoveryKey: (payload: any) => ipcRenderer.invoke('auth:resetWithRecoveryKey', payload),
  getSecurityConfig: () => ipcRenderer.invoke('auth:getSecurityConfig'),

  // Users
  getAllUsers: (payload: any) => ipcRenderer.invoke('users:getAll', payload),
  createUser: (payload: any) => ipcRenderer.invoke('users:create', payload),
  updateUser: (payload: any) => ipcRenderer.invoke('users:update', payload),

  // Bookings
  getSlotsForShift: (payload: any) => ipcRenderer.invoke('bookings:getSlotsForShift', payload),
  quickBook: (payload: any) => ipcRenderer.invoke('bookings:quickBook', payload),
  updateBookingStatus: (payload: any) => ipcRenderer.invoke('bookings:updateStatus', payload),
  updateBooking: (payload: any) => ipcRenderer.invoke('bookings:update', payload),
  deleteBooking: (payload: any) => ipcRenderer.invoke('bookings:delete', payload),
  searchBookings: (payload: any) => ipcRenderer.invoke('bookings:search', payload),

  // Patients
  searchPatients: (payload: any) => ipcRenderer.invoke('patients:search', payload),
  getPatientHistory: (payload: any) => ipcRenderer.invoke('patients:getHistory', payload),

  // Waiting List
  getWaitingList: (payload: any) => ipcRenderer.invoke('waitingList:get', payload),
  addWaitingList: (payload: any) => ipcRenderer.invoke('waitingList:add', payload),
  deleteWaitingList: (payload: any) => ipcRenderer.invoke('waitingList:delete', payload),

  // Analytics & Reports
  getDailyStats: (payload: any) => ipcRenderer.invoke('analytics:getDailyStats', payload),
  getFullAnalyticsReport: (payload: any) => ipcRenderer.invoke('analytics:getFullReport', payload),
  getMonthlyPatientReport: (payload: any) => ipcRenderer.invoke('analytics:getMonthlyPatientReport', payload),

  // Settings
  getClinicInfo: () => ipcRenderer.invoke('settings:getClinicInfo'),
  updateClinicInfo: (payload: any) => ipcRenderer.invoke('settings:updateClinicInfo', payload),
  getLookups: (payload: any) => ipcRenderer.invoke('settings:getLookups', payload),
  getAreas: (payload: any) => ipcRenderer.invoke('settings:getAreas', payload),
  createLookup: (payload: any) => ipcRenderer.invoke('settings:createLookup', payload),
  updateLookup: (payload: any) => ipcRenderer.invoke('settings:updateLookup', payload),
  deleteLookup: (payload: any) => ipcRenderer.invoke('settings:deleteLookup', payload),
  getDoctors: () => ipcRenderer.invoke('settings:getDoctors'),
  getActiveDoctors: () => ipcRenderer.invoke('settings:getActiveDoctors'),
  createDoctor: (payload: any) => ipcRenderer.invoke('settings:createDoctor', payload),
  updateDoctor: (payload: any) => ipcRenderer.invoke('settings:updateDoctor', payload),
  deleteDoctor: (payload: any) => ipcRenderer.invoke('settings:deleteDoctor', payload),
  getShifts: (payload: any) => ipcRenderer.invoke('settings:getShifts', payload),
  createShift: (payload: any) => ipcRenderer.invoke('settings:createShift', payload),
  updateShift: (payload: any) => ipcRenderer.invoke('settings:updateShift', payload),
  deleteShift: (payload: any) => ipcRenderer.invoke('settings:deleteShift', payload),

  // Audit
  getRecentAuditLogs: (payload: any) => ipcRenderer.invoke('audit:getRecentLogs', payload),

  // Backup
  listBackups: (payload: any) => ipcRenderer.invoke('backup:list', payload),
  createBackup: (payload: any) => ipcRenderer.invoke('backup:create', payload),
  restoreBackup: (payload: any) => ipcRenderer.invoke('backup:restore', payload),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
