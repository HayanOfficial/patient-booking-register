import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base.repository';
import { LookupItem, LookupCategory } from '../../src/types';

export class LookupRepository extends BaseRepository<LookupItem> {
  constructor() {
    super('lookup_items');
  }

  public getByCategory(category: LookupCategory, onlyActive: boolean = true): LookupItem[] {
    const sql = onlyActive
      ? `SELECT * FROM lookup_items WHERE category = ? AND is_active = 1 AND (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM lookup_items WHERE category = ? AND (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, name ASC`;
    return this.dbWrapper.all<LookupItem>(sql, [category]);
  }

  public getAreasForCity(cityId: string, onlyActive: boolean = true): LookupItem[] {
    const sql = onlyActive
      ? `SELECT * FROM lookup_items WHERE category = 'area' AND parent_id = ? AND is_active = 1 AND (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM lookup_items WHERE category = 'area' AND parent_id = ? AND (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, name ASC`;
    return this.dbWrapper.all<LookupItem>(sql, [cityId]);
  }

  public create(item: {
    category: LookupCategory;
    name: string;
    parent_id?: string | null;
    color?: string;
    icon?: string;
    is_active?: boolean;
    sort_order?: number;
  }): LookupItem {
    const id = uuidv4();
    const now = new Date().toISOString();
    const sortOrder = item.sort_order ?? 99;

    this.dbWrapper.run(
      `INSERT INTO lookup_items (id, category, name, parent_id, color, icon, is_active, sort_order, created_at, updated_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        item.category,
        item.name,
        item.parent_id || null,
        item.color || null,
        item.icon || null,
        item.is_active !== false ? 1 : 0,
        sortOrder,
        now,
        now,
        this.deviceId,
      ]
    );

    const created = this.findById(id)!;
    this.recordChangeLog('INSERT', id, created);
    return created;
  }

  public update(id: string, updates: Partial<LookupItem>): LookupItem | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.parent_id !== undefined) {
      fields.push('parent_id = ?');
      params.push(updates.parent_id);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      params.push(updates.color);
    }
    if (updates.icon !== undefined) {
      fields.push('icon = ?');
      params.push(updates.icon);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }
    if (updates.sort_order !== undefined) {
      fields.push('sort_order = ?');
      params.push(updates.sort_order);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    this.dbWrapper.run(`UPDATE lookup_items SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = this.findById(id)!;
    this.recordChangeLog('UPDATE', id, updated);
    return updated;
  }
}
