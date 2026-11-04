import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { dbInstance } from '../db/database';
import { AuditRepository } from '../repositories/other.repositories';

export interface BackupFileInfo {
  filename: string;
  filepath: string;
  sizeBytes: number;
  createdAt: string;
  isAuto: boolean;
}

export class BackupService {
  private auditRepo: AuditRepository;

  constructor() {
    this.auditRepo = new AuditRepository();
  }

  private getBackupDirectory(): string {
    let baseDir: string;
    try {
      baseDir = app ? app.getPath('userData') : path.join(process.cwd(), 'local-data');
    } catch {
      baseDir = path.join(process.cwd(), 'local-data');
    }
    const backupDir = path.join(baseDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  }

  public listBackups(): BackupFileInfo[] {
    const backupDir = this.getBackupDirectory();
    const files = fs.readdirSync(backupDir);
    const backups: BackupFileInfo[] = [];

    for (const f of files) {
      if (f.endsWith('.sqlite') || f.endsWith('.bak')) {
        const fullPath = path.join(backupDir, f);
        const stats = fs.statSync(fullPath);
        backups.push({
          filename: f,
          filepath: fullPath,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
          isAuto: f.startsWith('auto_backup_'),
        });
      }
    }

    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createBackup(isAuto: boolean = false, actorUser?: { id: string; username: string }): { success: boolean; filepath?: string; message?: string } {
    try {
      const backupDir = this.getBackupDirectory();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const prefix = isAuto ? 'auto_backup_' : 'manual_backup_';
      const filename = `${prefix}${timestamp}.sqlite`;
      const targetPath = path.join(backupDir, filename);

      dbInstance.persistImmediate();
      const currentDbPath = dbInstance.getDbPath();

      if (fs.existsSync(currentDbPath)) {
        fs.copyFileSync(currentDbPath, targetPath);
      } else {
        // Export from memory
        const data = dbInstance.getDb().export();
        fs.writeFileSync(targetPath, Buffer.from(data));
      }

      if (isAuto) {
        this.pruneAutoBackups(7);
      }

      if (actorUser) {
        this.auditRepo.log({
          user_id: actorUser.id,
          username: actorUser.username,
          action_type: 'BACKUP_CREATE',
          entity_type: 'backup',
          details: { filename, isAuto },
        });
      }

      return { success: true, filepath: targetPath };
    } catch (err: any) {
      console.error('Backup creation failed:', err);
      return { success: false, message: err.message || 'Failed to create backup.' };
    }
  }

  public pruneAutoBackups(maxKeep: number = 7): void {
    try {
      const backups = this.listBackups().filter((b) => b.isAuto);
      if (backups.length > maxKeep) {
        const toDelete = backups.slice(maxKeep);
        for (const b of toDelete) {
          if (fs.existsSync(b.filepath)) {
            fs.unlinkSync(b.filepath);
          }
        }
      }
    } catch (err) {
      console.error('Failed to prune old backups:', err);
    }
  }

  public restoreFromBackup(
    backupPath: string,
    actorUser: { id: string; username: string; role: string }
  ): { success: boolean; message?: string } {
    if (actorUser.role !== 'admin') {
      return { success: false, message: 'Access denied: Only Administrators can restore backups.' };
    }

    try {
      if (!fs.existsSync(backupPath)) {
        return { success: false, message: 'Backup file does not exist.' };
      }

      // First create a safety backup of current state
      this.createBackup(false, actorUser);

      const targetDbPath = dbInstance.getDbPath();
      fs.copyFileSync(backupPath, targetDbPath);

      this.auditRepo.log({
        user_id: actorUser.id,
        username: actorUser.username,
        action_type: 'RESTORE',
        entity_type: 'backup',
        details: { restoredFrom: path.basename(backupPath) },
      });

      return { success: true, message: 'Database restored successfully. The application will reload data.' };
    } catch (err: any) {
      console.error('Restore failed:', err);
      return { success: false, message: err.message || 'Failed to restore database.' };
    }
  }
}
