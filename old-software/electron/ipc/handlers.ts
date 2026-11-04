import { ipcMain } from 'electron';
import { AuthService } from '../services/auth.service';
import { BookingService, QuickBookPayload } from '../services/booking.service';
import { AnalyticsService } from '../services/analytics.service';
import { SettingsService } from '../services/settings.service';
import { BackupService } from '../services/backup.service';
import { PatientRepository } from '../repositories/patient.repository';
import { WaitingListRepository, AuditRepository } from '../repositories/other.repositories';
import { BookingStatus, PermissionKey } from '../../src/types';

export function registerIpcHandlers(): void {
  const authService = new AuthService();
  const bookingService = new BookingService();
  const analyticsService = new AnalyticsService();
  const settingsService = new SettingsService();
  const backupService = new BackupService();
  const patientRepo = new PatientRepository();
  const waitingRepo = new WaitingListRepository();
  const auditRepo = new AuditRepository();

  // AUTH
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    return authService.login(username, password);
  });

  ipcMain.handle('auth:logout', async (_, { userId, username }) => {
    authService.logout(userId, username);
    return { success: true };
  });

  ipcMain.handle('auth:changePassword', async (_, { userId, newPassword, actorUser }) => {
    return authService.changePassword(userId, newPassword, actorUser);
  });

  ipcMain.handle('auth:resetWithRecoveryKey', async (_, { recoveryKey, newPassword }) => {
    return authService.resetAdminPasswordWithRecoveryKey(recoveryKey, newPassword);
  });

  ipcMain.handle('auth:getSecurityConfig', async () => {
    return authService.getSecurityConfig();
  });

  // USERS & PERMISSIONS (Admin only)
  ipcMain.handle('users:getAll', async (_, { actorRole }) => {
    return authService.getAllUsers(actorRole);
  });

  ipcMain.handle('users:create', async (_, { actorUser, data }) => {
    return authService.createUser(actorUser, data);
  });

  ipcMain.handle('users:update', async (_, { actorUser, userId, updates }) => {
    return authService.updateUser(actorUser, userId, updates);
  });

  // BOOKINGS & SLOTS
  ipcMain.handle('bookings:getSlotsForShift', async (_, { date, doctorId, shiftId }) => {
    return bookingService.getSlotsForShift(date, doctorId, shiftId);
  });

  ipcMain.handle('bookings:quickBook', async (_, { payload, actorUser }) => {
    return bookingService.createQuickBooking(payload as QuickBookPayload, actorUser);
  });

  ipcMain.handle('bookings:updateStatus', async (_, { bookingId, status, actorUser }) => {
    return bookingService.updateBookingStatus(bookingId, status as BookingStatus, actorUser);
  });

  ipcMain.handle('bookings:update', async (_, { bookingId, updates, actorUser }) => {
    return bookingService.updateBooking(bookingId, updates, actorUser);
  });

  ipcMain.handle('bookings:delete', async (_, { bookingId, actorUser }) => {
    return bookingService.deleteBooking(bookingId, actorUser);
  });

  ipcMain.handle('bookings:search', async (_, { query }) => {
    return bookingService['bookingRepo'].searchBookings(query);
  });

  // PATIENTS
  ipcMain.handle('patients:search', async (_, { query }) => {
    return patientRepo.search(query);
  });

  ipcMain.handle('patients:getHistory', async (_, { patientId }) => {
    return patientRepo.getPatientVisitHistory(patientId);
  });

  // WAITING LIST
  ipcMain.handle('waitingList:get', async (_, { date, doctorId, shiftId }) => {
    return waitingRepo.getWaitingListForDate(date, doctorId, shiftId);
  });

  ipcMain.handle('waitingList:add', async (_, { item, actorUser }) => {
    const created = waitingRepo.create(item);
    auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'WAITING_LIST_ADD',
      entity_type: 'waiting_list',
      entity_id: created.id,
      details: item,
    });
    return created;
  });

  ipcMain.handle('waitingList:delete', async (_, { id, actorUser }) => {
    const deleted = waitingRepo.softDelete(id);
    auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'WAITING_LIST_DELETE',
      entity_type: 'waiting_list',
      entity_id: id,
      details: {},
    });
    return deleted;
  });

  // ANALYTICS & STAT CARDS
  ipcMain.handle('analytics:getDailyStats', async (_, { date, doctorId, shiftId }) => {
    return analyticsService.getDailyStats(date, doctorId, shiftId);
  });

  ipcMain.handle('analytics:getFullReport', async (_, { startDate, endDate, doctorId }) => {
    return analyticsService.getFullAnalyticsReport(startDate, endDate, doctorId);
  });

  ipcMain.handle('analytics:getMonthlyPatientReport', async (_, payload) => {
    return analyticsService.getMonthlyPatientReport(payload);
  });

  // SETTINGS & LOOKUPS
  ipcMain.handle('settings:getClinicInfo', async () => {
    return settingsService.getClinicInfo();
  });

  ipcMain.handle('settings:updateClinicInfo', async (_, { info, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    settingsService.updateClinicInfo(info, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
    return { success: true };
  });

  ipcMain.handle('settings:getLookups', async (_, { category, onlyActive }) => {
    return settingsService.getLookupsByCategory(category, onlyActive);
  });

  ipcMain.handle('settings:getAreas', async (_, { cityId, onlyActive }) => {
    return settingsService.getAreasForCity(cityId, onlyActive);
  });

  ipcMain.handle('settings:createLookup', async (_, { item, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.createLookupItem(item, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('settings:updateLookup', async (_, { id, updates, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.updateLookupItem(id, updates, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('settings:deleteLookup', async (_, { id, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.deleteLookupItem(id, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('settings:getDoctors', async () => {
    return settingsService.getAllDoctors();
  });

  ipcMain.handle('settings:getActiveDoctors', async () => {
    return settingsService.getActiveDoctors();
  });

  ipcMain.handle('settings:createDoctor', async (_, { doc, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.createDoctor(doc, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('settings:updateDoctor', async (_, { id, updates, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.updateDoctor(id, updates, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('settings:deleteDoctor', async (_, { id, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.deleteDoctor(id, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('settings:getShifts', async (_, { doctorId }) => {
    return settingsService.getShiftsForDoctor(doctorId);
  });

  ipcMain.handle('settings:createShift', async (_, { shift, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.createShift(shift, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('settings:updateShift', async (_, { id, updates, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.updateShift(id, updates, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('settings:deleteShift', async (_, { id, actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'settings.manage');
    return settingsService.deleteShift(id, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  // AUDIT LOGS
  ipcMain.handle('audit:getRecentLogs', async (_, { limit, actorRole }) => {
    authService.enforcePermission(actorRole || 'admin', 'audit.view');
    return auditRepo.getRecentLogs(limit || 100);
  });

  // BACKUPS
  ipcMain.handle('backup:list', async (_, { actorRole }) => {
    authService.enforcePermission(actorRole || 'admin', 'backup.manage');
    return backupService.listBackups();
  });

  ipcMain.handle('backup:create', async (_, { actorUser }) => {
    authService.enforcePermission(actorUser?.role || 'admin', 'backup.manage');
    return backupService.createBackup(false, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });

  ipcMain.handle('backup:restore', async (_, { backupPath, actorUser }) => {
    return backupService.restoreFromBackup(backupPath, actorUser || { id: 'admin', username: 'admin', role: 'admin' });
  });
}
