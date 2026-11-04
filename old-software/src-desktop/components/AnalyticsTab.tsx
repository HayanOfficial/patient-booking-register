import React, { useState, useEffect } from 'react';
import { BarChart2, Calendar, TrendingUp, Users, AlertTriangle, CheckCircle, Tag, Filter } from 'lucide-react';
import { api } from '../services/api';
import { Doctor } from '../types';
import { useAuth } from '../context/AuthContext';

interface AnalyticsTabProps {
  doctors: Doctor[];
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ doctors }) => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const data = await api.getFullAnalyticsReport({
        startDate,
        endDate,
        doctorId: selectedDoctorId || undefined,
        actorRole: user?.role || 'admin',
      });
      setReport(data);
    } catch (err) {
      console.error('Failed to load analytics report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, selectedDoctorId]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-amber-500" />
            <span>Booking Analytics & Source Channel Report</span>
          </h2>
          <p className="text-xs text-slate-500">
            Performance metrics, patient acquisition channels, and attendance patterns.
          </p>
        </div>

        {/* Date Pickers & Doctor Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden font-mono font-bold text-slate-800"
            />
            <span className="font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden font-mono font-bold text-slate-800"
            />
          </div>

          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          >
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Loading analytics...</div>
      ) : report ? (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Bookings</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900 font-mono">{report.totalBookings}</span>
                <span className="text-xs text-slate-400 font-semibold">in period</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Attended & Checked In</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-emerald-600 font-mono">{report.completedCount}</span>
                <span className="text-xs text-emerald-700 font-bold">
                  {report.totalBookings > 0 ? ((report.completedCount / report.totalBookings) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">Absent / No-Show</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-rose-600 font-mono">{report.absentCount}</span>
                <span className="text-xs text-rose-700 font-bold">{report.absentRate}%</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">Primary Channel</span>
              <div className="mt-1">
                <span className="text-xl font-black text-blue-800">
                  {report.sourceDistribution[0]?.source || 'None'}
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  {report.sourceDistribution[0]?.percentage || 0}% of all bookings
                </span>
              </div>
            </div>
          </div>

          {/* Sources Breakdown Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-500" />
                <span>Patient Acquisition by Source Channel</span>
              </h3>

              <div className="space-y-2.5">
                {report.sourceDistribution.map((src: any) => (
                  <div key={src.source} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800">{src.source}</span>
                      <span className="font-mono text-slate-600">
                        {src.count} bookings ({src.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${src.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Purpose Breakdown Table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-500" />
                <span>Purpose of Visit Breakdown</span>
              </h3>

              <div className="space-y-2.5">
                {report.purposeDistribution.map((purp: any) => (
                  <div key={purp.purpose} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800">{purp.purpose}</span>
                      <span className="font-mono text-slate-600">
                        {purp.count} ({purp.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${purp.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
