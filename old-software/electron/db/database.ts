import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { app } from 'electron';

export class AppDatabase {
  private static instance: AppDatabase;
  private db: SqlJsDatabase | null = null;
  private dbFilePath: string = '';
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): AppDatabase {
    if (!AppDatabase.instance) {
      AppDatabase.instance = new AppDatabase();
    }
    return AppDatabase.instance;
  }

  public async initialize(customPath?: string): Promise<SqlJsDatabase> {
    if (this.db) return this.db;

    const SQL = await initSqlJs({
      // Locate sql-wasm.wasm either in node_modules or dist
      locateFile: (file) => {
        const potentialPaths = [
          path.join(__dirname, '../../node_modules/sql.js/dist', file),
          path.join(__dirname, '../node_modules/sql.js/dist', file),
          path.join(process.cwd(), 'node_modules/sql.js/dist', file),
          path.join(__dirname, file),
        ];
        for (const p of potentialPaths) {
          if (fs.existsSync(p)) return p;
        }
        return path.join(process.cwd(), 'node_modules/sql.js/dist', file);
      },
    });

    // Determine DB directory
    let dbDir: string;
    if (customPath) {
      this.dbFilePath = customPath;
      dbDir = path.dirname(customPath);
    } else {
      try {
        const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'local-data');
        dbDir = path.join(userDataPath, 'data');
      } catch (e) {
        dbDir = path.join(process.cwd(), 'local-data');
      }
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      this.dbFilePath = path.join(dbDir, 'patient_register.sqlite');
    }

    if (!fs.existsSync(path.dirname(this.dbFilePath))) {
      fs.mkdirSync(path.dirname(this.dbFilePath), { recursive: true });
    }

    if (fs.existsSync(this.dbFilePath)) {
      const fileBuffer = fs.readFileSync(this.dbFilePath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
      this.persistImmediate();
    }

    // Enable foreign keys
    this.db.run("PRAGMA foreign_keys = ON;");

    return this.db;
  }

  public getDb(): SqlJsDatabase {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  public getDbPath(): string {
    return this.dbFilePath;
  }

  /**
   * Save database buffer to disk
   */
  public persist(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistImmediate();
    }, 100);
  }

  public persistImmediate(): void {
    if (!this.db || !this.dbFilePath) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbFilePath, buffer);
    } catch (err) {
      console.error("Failed to persist database to disk:", err);
    }
  }

  /**
   * Helper: Run statement with parameters
   */
  public run(sql: string, params: (string | number | null | Uint8Array)[] = []): void {
    const db = this.getDb();
    db.run(sql, params as any);
    this.persist();
  }

  /**
   * Helper: Query single row
   */
  public get<T = any>(sql: string, params: (string | number | null | Uint8Array)[] = []): T | null {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as any);
    let result: T | null = null;
    if (stmt.step()) {
      result = stmt.getAsObject() as unknown as T;
    }
    stmt.free();
    return result;
  }

  /**
   * Helper: Query all rows
   */
  public all<T = any>(sql: string, params: (string | number | null | Uint8Array)[] = []): T[] {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as any);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return results;
  }

  /**
   * Execute raw SQL script (e.g. migrations)
   */
  public exec(sql: string): void {
    const db = this.getDb();
    db.exec(sql);
    this.persist();
  }
}

export const dbInstance = AppDatabase.getInstance();
