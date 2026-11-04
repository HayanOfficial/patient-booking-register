import { v4 as uuidv4 } from 'uuid';
import { AppDatabase, dbInstance } from '../db/database';

export abstract class BaseRepository<T extends { id: string; created_at?: string; updated_at?: string; deleted_at?: string | null; device_id?: string }> {
  protected dbWrapper: AppDatabase;
  protected tableName: string;
  protected deviceId: string = 'DEV1';

  constructor(tableName: string) {
    this.dbWrapper = dbInstance;
    this.tableName = tableName;
  }

  public setDeviceId(deviceId: string): void {
    this.deviceId = deviceId;
  }

  /**
   * Log an entry in change_log for future P2P / LAN synchronization
   */
  protected recordChangeLog(operation: 'INSERT' | 'UPDATE' | 'DELETE', recordId: string, data: any): void {
    const logId = uuidv4();
    const timestamp = new Date().toISOString();
    const dataJson = JSON.stringify(data);
    this.dbWrapper.run(
      `INSERT INTO change_log (id, table_name, record_id, operation, data_json, synced, timestamp, device_id)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [logId, this.tableName, recordId, operation, dataJson, timestamp, this.deviceId]
    );
  }

  public findById(id: string): T | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`;
    return this.dbWrapper.get<T>(sql, [id]);
  }

  public findAll(includeDeleted: boolean = false): T[] {
    const sql = includeDeleted
      ? `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`
      : `SELECT * FROM ${this.tableName} WHERE (deleted_at IS NULL OR deleted_at = '') ORDER BY created_at DESC`;
    return this.dbWrapper.all<T>(sql);
  }

  public softDelete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    this.dbWrapper.run(
      `UPDATE ${this.tableName} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );

    this.recordChangeLog('DELETE', id, { ...existing, deleted_at: now, updated_at: now });
    return true;
  }

  public restore(id: string): boolean {
    const now = new Date().toISOString();
    this.dbWrapper.run(
      `UPDATE ${this.tableName} SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
      [now, id]
    );
    const updated = this.findById(id);
    if (updated) {
      this.recordChangeLog('UPDATE', id, updated);
      return true;
    }
    return false;
  }
}
