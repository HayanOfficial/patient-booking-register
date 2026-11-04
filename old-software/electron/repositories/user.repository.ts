import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { User, RolePermission } from '../../src/types';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  public findByUsername(username: string): (User & { password_hash: string }) | null {
    const sql = `SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND (deleted_at IS NULL OR deleted_at = '')`;
    return this.dbWrapper.get<User & { password_hash: string }>(sql, [username]);
  }

  public create(user: {
    username: string;
    password_hash: string;
    full_name: string;
    role: string;
    status?: 'active' | 'disabled';
    must_change_password?: boolean;
  }): User {
    const id = uuidv4();
    const now = new Date().toISOString();
    const status = user.status || 'active';
    const mustChange = user.must_change_password ? 1 : 0;

    this.dbWrapper.run(
      `INSERT INTO users (id, username, password_hash, full_name, role, status, must_change_password, failed_attempts, created_at, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, user.username, user.password_hash, user.full_name, user.role, status, mustChange, now, now, this.deviceId]
    );

    const created = this.findById(id)!;
    this.recordChangeLog('INSERT', id, created);
    return created;
  }

  public update(id: string, updates: Partial<User> & { password_hash?: string }): User | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.full_name !== undefined) {
      fields.push('full_name = ?');
      params.push(updates.full_name);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      params.push(updates.role);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.must_change_password !== undefined) {
      fields.push('must_change_password = ?');
      params.push(updates.must_change_password ? 1 : 0);
    }
    if (updates.failed_attempts !== undefined) {
      fields.push('failed_attempts = ?');
      params.push(updates.failed_attempts);
    }
    if (updates.lockout_until !== undefined) {
      fields.push('lockout_until = ?');
      params.push(updates.lockout_until);
    }
    if (updates.last_login_at !== undefined) {
      fields.push('last_login_at = ?');
      params.push(updates.last_login_at);
    }
    if (updates.password_hash !== undefined) {
      fields.push('password_hash = ?');
      params.push(updates.password_hash);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    this.dbWrapper.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

    const updated = this.findById(id)!;
    this.recordChangeLog('UPDATE', id, updated);
    return updated;
  }

  public countActiveAdmins(): number {
    const res = this.dbWrapper.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active' AND (deleted_at IS NULL OR deleted_at = '')`
    );
    return res ? res.count : 0;
  }

  public getPermissionsForRole(roleName: string): string[] {
    const rows = this.dbWrapper.all<RolePermission>(
      `SELECT permission_key FROM roles_permissions WHERE role_name = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      [roleName]
    );
    return rows.map((r) => r.permission_key);
  }

  public getAllRolePermissions(): Record<string, string[]> {
    const rows = this.dbWrapper.all<RolePermission>(
      `SELECT role_name, permission_key FROM roles_permissions WHERE (deleted_at IS NULL OR deleted_at = '')`
    );
    const result: Record<string, string[]> = {};
    for (const row of rows) {
      if (!result[row.role_name]) {
        result[row.role_name] = [];
      }
      result[row.role_name].push(row.permission_key);
    }
    return result;
  }

  public setRolePermissions(roleName: string, permissions: string[]): void {
    const now = new Date().toISOString();
    // Delete existing
    this.dbWrapper.run(`DELETE FROM roles_permissions WHERE role_name = ?`, [roleName]);
    // Insert new
    for (const perm of permissions) {
      const id = uuidv4();
      this.dbWrapper.run(
        `INSERT INTO roles_permissions (id, role_name, permission_key, created_at, updated_at, device_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, roleName, perm, now, now, this.deviceId]
      );
    }
    this.recordChangeLog('UPDATE', roleName, { role_name: roleName, permissions });
  }
}
