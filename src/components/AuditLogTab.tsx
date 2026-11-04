'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Shield, RefreshCw, Clock, User, Activity } from 'lucide-react';
import { AuditLog } from '../types';
import { api } from '../services/api';

export const AuditLogTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAuditLogs(100);
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

  const actionColors: Record<string, string> = {
    booking_create: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    status_change: 'bg-blue-100 text-blue-800 border-blue-200',
    token_reprint: 'bg-amber-100 text-amber-800 border-amber-200',
    booking_delete: 'bg-rose-100 text-rose-800 border-rose-200',
    login: 'bg-purple-100 text-purple-800 border-purple-200',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <span>Operational & Security Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500">
            Immutable log of all user logins, booking creations, status updates, and token reprints.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2 border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
          title="Refresh Log"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-extrabold uppercase text-[11px] text-slate-500">
              <th className="py-3 px-4 w-40">Timestamp</th>
              <th className="py-3 px-4 w-32">User</th>
              <th className="py-3 px-4 w-36">Action</th>
              <th className="py-3 px-4 w-28">Entity</th>
              <th className="py-3 px-4">Event Payload / Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900">{log.username}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        actionColors[log.action_type] || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {log.action_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 uppercase font-bold text-slate-500 text-[10px]">
                    {log.entity_type}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    <pre className="whitespace-pre-wrap font-mono text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 max-w-xl">
                      {JSON.stringify(log.details_json, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
