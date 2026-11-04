import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, ShieldAlert, User, Calendar } from 'lucide-react';
import { AuditLog } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const AuditLogTab: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getRecentAuditLogs({ limit: 150, actorRole: user?.role || 'admin' });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.username.toLowerCase().includes(q) ||
      log.action_type.toLowerCase().includes(q) ||
      log.entity_type.toLowerCase().includes(q) ||
      log.details_json.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            <span>Security & Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of logins, logouts, booking creations, deletions, and administrative actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-300 rounded-full pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <button
            onClick={loadLogs}
            title="Refresh Logs"
            className="p-2 bg-white border border-slate-300 rounded-full hover:bg-slate-50 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 w-40">Timestamp</th>
                <th className="py-3 px-4 w-32">User</th>
                <th className="py-3 px-4 w-40">Action</th>
                <th className="py-3 px-4 w-28">Entity</th>
                <th className="py-3 px-4">Event Details & Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                let parsedDetails: any = null;
                try {
                  parsedDetails = JSON.parse(log.details_json);
                } catch {
                  parsedDetails = log.details_json;
                }

                const isAuth = log.action_type.includes('LOGIN') || log.action_type.includes('LOGOUT') || log.action_type.includes('PASSWORD');
                const isDelete = log.action_type.includes('DELETE');

                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{log.username}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                          isDelete
                            ? 'bg-rose-100 text-rose-800'
                            : isAuth
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {log.action_type}
                      </span>
                    </td>

                    <td className="py-3 px-4 capitalize text-slate-600 font-semibold">{log.entity_type}</td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700 max-w-md truncate">
                      {typeof parsedDetails === 'object' ? JSON.stringify(parsedDetails) : parsedDetails}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
