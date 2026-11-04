import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../repositories/user.repository';
import { AuditRepository, SettingRepository } from '../repositories/other.repositories';
import { User, PermissionKey } from '../../src/types';

export interface SecurityConfig {
  idle_timeout_minutes: number;
  max_failed_attempts: number;
  lockout_minutes: number;
  recovery_key: string;
}

export class AuthService {
  private userRepo: UserRepository;
  private auditRepo: AuditRepository;
  private settingRepo: SettingRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.auditRepo = new AuditRepository();
    this.settingRepo = new SettingRepository();
  }

  public getSecurityConfig(): SecurityConfig {
    return this.settingRepo.getSetting<SecurityConfig>('security_config', {
      idle_timeout_minutes: 15,
      max_failed_attempts: 5,
      lockout_minutes: 5,
      recovery_key: 'RECOVER-PBR-7849-AK92-X901',
    });
  }

  public async login(username: string, passwordPlain: string): Promise<{ success: boolean; user?: User; message?: string; mustChangePassword?: boolean }> {
    const user = this.userRepo.findByUsername(username);
    if (!user) {
      this.auditRepo.log({
        user_id: 'unknown',
        username: username,
        action_type: 'FAILED_LOGIN',
        entity_type: 'user',
        details: { reason: 'User not found' },
      });
      return { success: false, message: 'Invalid username or password.' };
    }

    if (user.status === 'disabled') {
      return { success: false, message: 'This account is disabled. Please contact an Administrator.' };
    }

    // Check lockout
    const now = new Date();
    if (user.lockout_until && new Date(user.lockout_until) > now) {
      const remainingSecs = Math.ceil((new Date(user.lockout_until).getTime() - now.getTime()) / 1000);
      const remainingMins = Math.ceil(remainingSecs / 60);
      return {
        success: false,
        message: `Account is temporarily locked due to multiple failed attempts. Please retry in ${remainingMins} minute(s).`,
      };
    }

    const config = this.getSecurityConfig();
    const isPasswordValid = bcrypt.compareSync(passwordPlain, user.password_hash);

    if (!isPasswordValid) {
      const newAttempts = (user.failed_attempts || 0) + 1;
      let lockoutTime: string | null = null;
      let msg = 'Invalid username or password.';

      if (newAttempts >= config.max_failed_attempts) {
        const lockoutDate = new Date(now.getTime() + config.lockout_minutes * 60 * 1000);
        lockoutTime = lockoutDate.toISOString();
        msg = `Account locked for ${config.lockout_minutes} minutes due to ${newAttempts} consecutive failed attempts.`;
      }

      this.userRepo.update(user.id, {
        failed_attempts: newAttempts,
        lockout_until: lockoutTime,
      });

      this.auditRepo.log({
        user_id: user.id,
        username: user.username,
        action_type: 'FAILED_LOGIN',
        entity_type: 'user',
        entity_id: user.id,
        details: { attempts: newAttempts, locked: !!lockoutTime },
      });

      return { success: false, message: msg };
    }

    // Reset failed attempts and update last login
    this.userRepo.update(user.id, {
      failed_attempts: 0,
      lockout_until: null,
      last_login_at: now.toISOString(),
    });

    this.auditRepo.log({
      user_id: user.id,
      username: user.username,
      action_type: 'LOGIN',
      entity_type: 'user',
      entity_id: user.id,
      details: { role: user.role },
    });

    const refreshedUser = this.userRepo.findById(user.id)!;
    return {
      success: true,
      user: refreshedUser,
      mustChangePassword: Boolean(user.must_change_password),
    };
  }

  public logout(userId: string, username: string): void {
    this.auditRepo.log({
      user_id: userId,
      username: username,
      action_type: 'LOGOUT',
      entity_type: 'user',
      entity_id: userId,
      details: {},
    });
  }

  public changePassword(userId: string, newPasswordPlain: string, actorUser: { id: string; username: string }): { success: boolean; message?: string } {
    if (newPasswordPlain.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }
    const hash = bcrypt.hashSync(newPasswordPlain, 10);
    this.userRepo.update(userId, {
      password_hash: hash,
      must_change_password: false,
    });

    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'PASSWORD_CHANGE',
      entity_type: 'user',
      entity_id: userId,
      details: { targetUserId: userId },
    });

    return { success: true };
  }

  public resetAdminPasswordWithRecoveryKey(recoveryKey: string, newPasswordPlain: string): { success: boolean; message?: string } {
    const config = this.getSecurityConfig();
    if (!config.recovery_key || config.recovery_key.trim() !== recoveryKey.trim()) {
      return { success: false, message: 'Invalid recovery key.' };
    }

    const admin = this.userRepo.findAll().find((u) => u.role === 'admin' && u.status === 'active');
    if (!admin) {
      return { success: false, message: 'No active admin account found.' };
    }

    const hash = bcrypt.hashSync(newPasswordPlain, 10);
    this.userRepo.update(admin.id, {
      password_hash: hash,
      failed_attempts: 0,
      lockout_until: null,
      must_change_password: false,
    });

    this.auditRepo.log({
      user_id: admin.id,
      username: admin.username,
      action_type: 'RECOVERY_KEY_PASSWORD_RESET',
      entity_type: 'user',
      entity_id: admin.id,
      details: { recoveryUsed: true },
    });

    return { success: true };
  }

  public hasPermission(role?: string, permission?: PermissionKey): boolean {
    if (!role || role === 'admin') return true;
    if (!permission) return true;
    const permissions = this.userRepo.getPermissionsForRole(role);
    return permissions.includes(permission);
  }

  public enforcePermission(role?: string, permission?: PermissionKey): void {
    if (!this.hasPermission(role, permission)) {
      throw new Error(`Access Denied: Role '${role || 'unknown'}' lacks permission '${permission}'.`);
    }
  }

  public createUser(
    actorUser: { id: string; username: string; role: string },
    data: { username: string; password_plain: string; full_name: string; role: string; must_change_password?: boolean }
  ): { success: boolean; user?: User; message?: string } {
    this.enforcePermission(actorUser.role, 'users.manage');

    const existing = this.userRepo.findByUsername(data.username);
    if (existing) {
      return { success: false, message: `Username '${data.username}' is already taken.` };
    }

    const hash = bcrypt.hashSync(data.password_plain, 10);
    const created = this.userRepo.create({
      username: data.username,
      password_hash: hash,
      full_name: data.full_name,
      role: data.role,
      status: 'active',
      must_change_password: data.must_change_password ?? true,
    });

    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'USER_CREATE',
      entity_type: 'user',
      entity_id: created.id,
      details: { username: created.username, role: created.role },
    });

    return { success: true, user: created };
  }

  public updateUser(
    actorUser: { id: string; username: string; role: string },
    userId: string,
    updates: { full_name?: string; role?: string; status?: 'active' | 'disabled'; password_plain?: string }
  ): { success: boolean; user?: User; message?: string } {
    this.enforcePermission(actorUser.role, 'users.manage');

    const targetUser = this.userRepo.findById(userId);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    // Safety rule: Last active Admin can never be disabled or demoted
    if (targetUser.role === 'admin' && (updates.status === 'disabled' || (updates.role && updates.role !== 'admin'))) {
      const activeAdminCount = this.userRepo.countActiveAdmins();
      if (activeAdminCount <= 1) {
        return { success: false, message: 'Action forbidden: The last active Administrator cannot be disabled or demoted.' };
      }
    }

    const updatePayload: any = {};
    if (updates.full_name) updatePayload.full_name = updates.full_name;
    if (updates.role) updatePayload.role = updates.role;
    if (updates.status) updatePayload.status = updates.status;
    if (updates.password_plain) {
      updatePayload.password_hash = bcrypt.hashSync(updates.password_plain, 10);
      updatePayload.must_change_password = true;
    }

    const updated = this.userRepo.update(userId, updatePayload);
    if (!updated) return { success: false, message: 'Failed to update user.' };

    this.auditRepo.log({
      user_id: actorUser.id,
      username: actorUser.username,
      action_type: 'USER_UPDATE',
      entity_type: 'user',
      entity_id: userId,
      details: { ...updates, password_plain: updates.password_plain ? '[REDACTED]' : undefined },
    });

    return { success: true, user: updated };
  }

  public getAllUsers(actorRole: string): User[] {
    this.enforcePermission(actorRole, 'users.manage');
    return this.userRepo.findAll();
  }
}
