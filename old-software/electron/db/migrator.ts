import { AppDatabase } from './database';
import { migration001 } from './migrations/001_initial_schema';
import { getSeedDataSql } from './migrations/002_seed_data';
import { migration003 } from './migrations/003_update_doctor_zarin';
import { migration004 } from './migrations/004_extend_slots_and_cleanup';
import { migration005 } from './migrations/005_purge_dr_naeem';

export class DatabaseMigrator {
  public static async runMigrations(dbWrapper: AppDatabase): Promise<void> {
    const db = dbWrapper.getDb();

    // Ensure migrations table exists
    db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    // Check applied migrations
    const appliedVersions: number[] = [];
    const stmt = db.prepare("SELECT version FROM schema_migrations ORDER BY version ASC");
    while (stmt.step()) {
      const row = stmt.getAsObject() as { version: number };
      appliedVersions.push(row.version);
    }
    stmt.free();

    // Migration 1: Initial Schema
    if (!appliedVersions.includes(1)) {
      console.log('Running Migration 001: Initial Schema...');
      dbWrapper.exec(migration001);
      dbWrapper.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [1, '001_initial_schema', new Date().toISOString()]
      );
      console.log('Migration 001 completed.');
    }

    // Migration 2: Seed Data
    if (!appliedVersions.includes(2)) {
      console.log('Running Migration 002: Seed Data...');
      const seedSql = await getSeedDataSql();
      dbWrapper.exec(seedSql);
      dbWrapper.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [2, '002_seed_data', new Date().toISOString()]
      );
      console.log('Migration 002 completed.');
    }

    // Migration 3: Update Doctor Zarin
    if (!appliedVersions.includes(3)) {
      console.log('Running Migration 003: Update Doctor Zarin...');
      dbWrapper.exec(migration003);
      dbWrapper.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [3, '003_update_doctor_zarin', new Date().toISOString()]
      );
      console.log('Migration 003 completed.');
    }

    // Migration 4: Extend slots to 10 PM and Cleanup
    if (!appliedVersions.includes(4)) {
      console.log('Running Migration 004: Extend slots to 10 PM & Cleanup...');
      dbWrapper.exec(migration004);
      dbWrapper.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [4, '004_extend_slots_and_cleanup', new Date().toISOString()]
      );
      console.log('Migration 004 completed.');
    }

    // Migration 5: Purge Dr Naeem Khattak and enforce Dr Zarin
    if (!appliedVersions.includes(5)) {
      console.log('Running Migration 005: Purge Dr Naeem & Enforce Dr Zarin...');
      dbWrapper.exec(migration005);
      dbWrapper.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [5, '005_purge_dr_naeem', new Date().toISOString()]
      );
      console.log('Migration 005 completed.');
    }

    dbWrapper.persistImmediate();
  }
}
