import { LookupRepository } from '../repositories/lookup.repository';
import { DoctorRepository, ShiftRepository } from '../repositories/doctor.repository';
import { SettingRepository, AuditRepository } from '../repositories/other.repositories';
import { LookupCategory, LookupItem, Doctor, Shift, ClinicSettings } from '../../src/types';

export class SettingsService {
  private lookupRepo: LookupRepository;
  private doctorRepo: DoctorRepository;
  private shiftRepo: ShiftRepository;
  private settingRepo: SettingRepository;
  private auditRepo: AuditRepository;

  constructor() {
    this.lookupRepo = new LookupRepository();
    this.doctorRepo = new DoctorRepository();
    this.shiftRepo = new ShiftRepository();
    this.settingRepo = new SettingRepository();
    this.auditRepo = new AuditRepository();
  }

  public getClinicInfo(): ClinicSettings {
    return this.settingRepo.getSetting<ClinicSettings>('clinic_info', {
      name: 'Dr Zarin Medical Center',
      tagline: 'Real-time schedule and patient coordination center',
      phone: '+92-91-5840000',
      address: 'Khyber Medical Centre, Peshawar',
    });
  }

  public updateClinicInfo(info: ClinicSettings, actorUser: { id: string; username: string }): void {
    this.settingRepo.setSetting('clinic_info', info);
    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'SETTING_UPDATE',
      entity_type: 'setting',
      details: { key: 'clinic_info', name: info.name },
    });
  }

  public getLookupsByCategory(category: LookupCategory, onlyActive: boolean = false): LookupItem[] {
    return this.lookupRepo.getByCategory(category, onlyActive);
  }

  public getAreasForCity(cityId: string, onlyActive: boolean = false): LookupItem[] {
    return this.lookupRepo.getAreasForCity(cityId, onlyActive);
  }

  public createLookupItem(
    item: { category: LookupCategory; name: string; parent_id?: string | null; color?: string; icon?: string; sort_order?: number },
    actorUser: { id: string; username: string }
  ): LookupItem {
    const created = this.lookupRepo.create(item);
    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'LOOKUP_CREATE',
      entity_type: 'lookup_item',
      entity_id: created.id,
      details: item,
    });
    return created;
  }

  public updateLookupItem(
    id: string,
    updates: Partial<LookupItem>,
    actorUser: { id: string; username: string }
  ): LookupItem | null {
    const updated = this.lookupRepo.update(id, updates);
    if (updated) {
      this.auditRepo.log({
        user_id: actorUser.id,
        username: actorUser.username,
        action_type: 'LOOKUP_UPDATE',
        entity_type: 'lookup_item',
        entity_id: id,
        details: updates,
      });
    }
    return updated;
  }

  public deleteLookupItem(id: string, actorUser: { id: string; username: string }): boolean {
    const deleted = this.lookupRepo.softDelete(id);
    if (deleted) {
      this.auditRepo.log({
        user_id: actorUser.id,
        username: actorUser.username,
        action_type: 'LOOKUP_DELETE',
        entity_type: 'lookup_item',
        entity_id: id,
        details: {},
      });
    }
    return deleted;
  }

  // Doctor & Shift Management
  public getAllDoctors(): Doctor[] {
    return this.doctorRepo.findAll();
  }

  public getActiveDoctors(): Doctor[] {
    return this.doctorRepo.getActiveDoctors();
  }

  public createDoctor(doc: { name: string; specialty: string; phone?: string; avatar_url?: string }, actorUser: { id: string; username: string }): Doctor {
    const created = this.doctorRepo.create(doc);
    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'DOCTOR_CREATE',
      entity_type: 'doctor',
      entity_id: created.id,
      details: doc,
    });
    return created;
  }

  public updateDoctor(id: string, updates: Partial<Doctor>, actorUser: { id: string; username: string }): Doctor | null {
    const updated = this.doctorRepo.update(id, updates);
    if (updated) {
      this.auditRepo.log({
        user_id: actorUser.id,
        username: actorUser.username,
        action_type: 'DOCTOR_UPDATE',
        entity_type: 'doctor',
        entity_id: id,
        details: updates,
      });
    }
    return updated;
  }

  public deleteDoctor(id: string, actorUser: { id: string; username: string }): boolean {
    const success = this.doctorRepo.softDeleteDoctor(id);
    if (success) {
      this.auditRepo.log({
        user_id: actorUser.id,
        username: actorUser.username,
        action_type: 'DOCTOR_DELETE',
        entity_type: 'doctor',
        entity_id: id,
        details: {},
      });
    }
    return success;
  }

  public getShiftsForDoctor(doctorId: string): Shift[] {
    return this.shiftRepo.getShiftsForDoctor(doctorId);
  }

  public createShift(
    shift: { doctor_id: string; name: string; start_time: string; end_time: string; slot_duration_minutes: number; days_of_week?: string },
    actorUser: { id: string; username: string }
  ): Shift {
    const created = this.shiftRepo.create(shift);
    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'SHIFT_CREATE',
      entity_type: 'shift',
      entity_id: created.id,
      details: shift,
    });
    return created;
  }

  public updateShift(id: string, updates: Partial<Shift>, actorUser: { id: string; username: string }): Shift | null {
    const updated = this.shiftRepo.update(id, updates);
    if (updated) {
      this.auditRepo.log({
        user_id: actorUser.id,
        username: actorUser.username,
        action_type: 'SHIFT_UPDATE',
        entity_type: 'shift',
        entity_id: id,
        details: updates,
      });
    }
    return updated;
  }

  public deleteShift(id: string, actorUser: { id: string; username: string }): boolean {
    const success = this.shiftRepo.softDeleteShift(id);
    if (success) {
      this.auditRepo.log({
        user_id: actorUser.id,
        username: actorUser.username,
        action_type: 'SHIFT_DELETE',
        entity_type: 'shift',
        entity_id: id,
        details: {},
      });
    }
    return success;
  }
}
