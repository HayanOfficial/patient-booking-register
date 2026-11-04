import React, { useState, useEffect } from 'react';
import { Database, Download, RotateCcw, AlertTriangle, Check, ShieldCheck, HardDrive } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const BackupRestoreTab: React.FC = () => {
  const { user } = useAuth();
  const [backups, setBackups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const list = await api.listBackups(user?.role || 'admin');
      setBackups(list || []);
    } catch (err) {
      console.error('Failed to list backups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setStatusMsg(null);
    try {
      const res = await api.createBackup({ id: user?.id, username: user?.username });
      if (res.success) {
        setStatusMsg({ text: 'Backup snapshot created successfully.' });
        loadBackups();
      } else {
        setStatusMsg({ text: res.message || 'Backup failed', isError: true });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, isError: true });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (backup: any) => {
    const confirmed = window.confirm(
      `WARNING: Are you sure you want to restore the database from snapshot '${backup.filename}'?\nA safety backup of your current database will be saved first.`
    );
    if (!confirmed) return;

    setStatusMsg(null);
    try {
      const res = await api.restoreBackup({
        backupPath: backup.filepath,
        actorUser: { id: user?.id, username: user?.username, role: user?.role },
      });

      if (res.success) {
        setStatusMsg({ text: res.message || 'Database restored successfully! Reloading register.' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatusMsg({ text: res.message || 'Restore failed', isError: true });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, isError: true });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            <span>Database Backup & Point-in-Time Restore</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic daily rotation (keeps last 7 backups) + instant manual snapshots. Data is stored safely on local disk.
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={isBackingUp}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{isBackingUp ? 'Creating Backup...' : 'Create Backup Snapshot'}</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
            statusMsg.isError
              ? 'bg-rose-50 border border-rose-200 text-rose-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          }`}
        >
          {statusMsg.isError ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Backups List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-700">Available Database Backups ({backups.length})</span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted & Validated SQLite Format</span>
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No backups found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((b) => {
              const sizeKB = (b.sizeBytes / 1024).toFixed(1);
              return (
                <div
                  key={b.filename}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50 transition text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                      <HardDrive className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{b.filename}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.isAuto ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {b.isAuto ? 'Daily Auto' : 'Manual'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Created: {new Date(b.createdAt).toLocaleString()} • Size: {sizeKB} KB
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(b)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 hover:border-amber-500 hover:bg-amber-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Restore From This Backup</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
