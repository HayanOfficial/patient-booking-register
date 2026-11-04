'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart2,
  TrendingUp,
  PieChart as PieIcon,
  Clock,
  Users,
  Calendar,
  Download,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  UserX,
  Ticket,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Doctor, LookupItem } from '../types';
import { api } from '../services/api';
import { getTodayDateString, addDays } from '../utils/dateUtils';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';

interface ReportsTabProps {
  doctors: Doctor[];
  sources: LookupItem[];
}

export type ReportSubView =
  | 'overview'
  | 'source'
  | 'trends'
  | 'peak_hours'
  | 'user_perf'
  | 'doctor_shift'
  | 'tokens'
  | 'absent_followup';

const PIE_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#64748B'];

export const ReportsTab: React.FC<ReportsTabProps> = ({ doctors, sources }) => {
  const [subView, setSubView] = useState<ReportSubView>('overview');

  // Date Range Presets
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-29');

  useEffect(() => {
    const today = getTodayDateString();
    setEndDate(today);
    setStartDate(addDays(today, -30));
  }, []);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [trendGrouping, setTrendGrouping] = useState<'day' | 'week' | 'month'>('day');

  // Report Data States
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applyDatePreset = (preset: 'today' | 'yesterday' | '7days' | 'month' | 'custom') => {
    setDatePreset(preset);
    const today = getTodayDateString();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'yesterday') {
      const y = addDays(today, -1);
      setStartDate(y);
      setEndDate(y);
    } else if (preset === '7days') {
      setStartDate(addDays(today, -7));
      setEndDate(today);
    } else if (preset === 'month') {
      setStartDate(addDays(today, -30));
      setEndDate(today);
    }
  };

  const loadCurrentReport = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let data: any = null;
      if (subView === 'overview') {
        data = await api.getReportOverview(startDate, endDate, selectedDoctorId || undefined, selectedSource || undefined);
      } else if (subView === 'source') {
        data = await api.getReportBookingsBySource(startDate, endDate, selectedDoctorId || undefined);
      } else if (subView === 'trends') {
        data = await api.getReportTrends(startDate, endDate, selectedDoctorId || undefined, trendGrouping);
      } else if (subView === 'peak_hours') {
        data = await api.getReportPeakHours(startDate, endDate, selectedDoctorId || undefined);
      } else if (subView === 'user_perf') {
        data = await api.getReportUserPerformance(startDate, endDate);
      } else if (subView === 'doctor_shift') {
        data = await api.getReportDoctorShift(startDate, endDate);
      } else if (subView === 'tokens') {
        data = await api.getReportTokens(startDate, endDate, selectedDoctorId || undefined);
      } else if (subView === 'absent_followup') {
        data = await api.getReportAbsentAndFollowup(startDate, endDate, selectedDoctorId || undefined, 'all');
      }
      setReportData(data);
    } catch (err: any) {
      console.error('Failed to load report:', err);
      setErrorMsg(err.message || 'Error calculating report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentReport();
  }, [subView, startDate, endDate, selectedDoctorId, selectedSource, trendGrouping]);

  // Export Handlers
  const handleExportCSV = () => {
    if (!reportData) return;
    const filename = `Report_${subView}_${startDate}_to_${endDate}`;
    if (subView === 'overview' && reportData.dailyTrend) {
      exportToCSV(filename, reportData.dailyTrend);
    } else if (subView === 'source' && reportData.sources) {
      exportToCSV(filename, reportData.sources);
    } else if (Array.isArray(reportData)) {
      exportToCSV(filename, reportData);
    } else if (subView === 'tokens' && reportData.dailyTokens) {
      exportToCSV(filename, reportData.dailyTokens);
    }
  };

  const handleExportExcel = () => {
    if (!reportData) return;
    const filename = `Report_${subView}_${startDate}_to_${endDate}`;
    if (subView === 'overview' && reportData.dailyTrend) {
      exportToExcel(filename, reportData.dailyTrend);
    } else if (subView === 'source' && reportData.sources) {
      exportToExcel(filename, reportData.sources);
    } else if (Array.isArray(reportData)) {
      exportToExcel(filename, reportData);
    } else if (subView === 'tokens' && reportData.dailyTokens) {
      exportToExcel(filename, reportData.dailyTokens);
    }
  };

  const handleExportPDF = () => {
    if (!reportData) return;
    const filename = `Report_${subView}_${startDate}_to_${endDate}`;
    if (subView === 'absent_followup' && Array.isArray(reportData)) {
      const headers = ['Token', 'Date', 'Time', 'Patient', 'Phone', 'Doctor', 'Purpose', 'Status'];
      const rows = reportData.map((r: any) => [
        r.token_code,
        r.booking_date,
        r.slot_time_formatted,
        `${r.first_name} ${r.last_name || ''}`,
        r.full_phone,
        r.doctor_name,
        r.purpose,
        r.status,
      ]);
      exportToPDF('Absent & Follow-up Patient Register', headers, rows, filename);
    } else if (subView === 'source' && reportData.sources) {
      const headers = ['Source Channel', 'Total Booked', 'Share %', 'Attended', 'Absent', 'Conversion %'];
      const rows = reportData.sources.map((s: any) => [
        s.source,
        s.count,
        `${s.percentage}%`,
        s.checked_in + s.completed,
        s.absent,
        `${s.conversion_rate}%`,
      ]);
      exportToPDF('Acquisition Sources & Conversion Report', headers, rows, filename);
    } else {
      handleExportExcel();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header with Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-amber-500" />
            <span>Analytical Reports & Business Intelligence</span>
          </h2>
          <p className="text-xs text-slate-500">
            Database-aggregated clinical metrics, source conversion, trends, and queue performance.
          </p>
        </div>

        {/* Date Presets, Range Picker, and Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {(['today', 'yesterday', '7days', 'month', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyDatePreset(p)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                  datePreset === p
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === '7days' ? '7 Days' : p === 'month' ? '30 Days' : p}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
              className="bg-transparent border-none focus:outline-hidden"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
              className="bg-transparent border-none focus:outline-hidden"
            />
          </div>

          {/* Doctor Filter */}
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          >
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportCSV}
              className="p-2 border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700"
              title="Export CSV"
            >
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="p-2 border border-slate-300 rounded-xl hover:bg-slate-50 text-emerald-700 font-bold"
              title="Export Excel"
            >
              XLSX
            </button>
            <button
              onClick={handleExportPDF}
              className="p-2 border border-slate-300 rounded-xl hover:bg-slate-50 text-rose-700 font-bold"
              title="Export PDF"
            >
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sub-Tabs Navigation for All 8 Reports */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200">
        {[
          { key: 'overview', label: '1. Overview Dashboard', icon: BarChart2 },
          { key: 'source', label: '2. Bookings by Source', icon: PieIcon },
          { key: 'trends', label: '3. Booking Trends', icon: TrendingUp },
          { key: 'peak_hours', label: '4. Peak Hours & Heatmap', icon: Clock },
          { key: 'user_perf', label: '5. Staff Performance', icon: Users },
          { key: 'doctor_shift', label: '6. Shift Utilisation', icon: Calendar },
          { key: 'tokens', label: '7. Token Report', icon: Ticket },
          { key: 'absent_followup', label: '8. Absent & Follow-up', icon: UserX },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subView === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSubView(tab.key as ReportSubView)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Report Content Area */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
          <span className="text-xs font-semibold">Running database aggregation...</span>
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-rose-500" />
          <div className="font-bold">{errorMsg}</div>
          <button
            onClick={loadCurrentReport}
            className="px-4 py-1.5 bg-rose-600 text-white rounded-xl font-bold"
          >
            Retry Report
          </button>
        </div>
      ) : !reportData ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
          No data recorded for this date range.
        </div>
      ) : (
        <div className="space-y-6">
          {/* ================================================================ */}
          {/* REPORT 1: Overview Dashboard                                     */}
          {/* ================================================================ */}
          {subView === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Total Bookings
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-1">
                    {reportData.totalBookings}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Average {reportData.avgPerDay} / day
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Checked In / Attended
                  </span>
                  <div className="text-3xl font-black text-emerald-600 mt-1">
                    {reportData.checkedIn + (reportData.completed || 0)}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                    {reportData.totalBookings > 0
                      ? `${(
                          ((reportData.checkedIn + (reportData.completed || 0)) / reportData.totalBookings) *
                          100
                        ).toFixed(1)}% attendance rate`
                      : '0%'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Absent Patients
                  </span>
                  <div className="text-3xl font-black text-rose-600 mt-1">
                    {reportData.absent}
                  </div>
                  <div className="text-[11px] text-rose-500 font-semibold mt-1">
                    {reportData.absentRate}% absenteeism
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Completed Consultations
                  </span>
                  <div className="text-3xl font-black text-amber-500 mt-1">
                    {reportData.completed}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Finished visits</div>
                </div>
              </div>

              {/* Trend Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-slate-900 mb-4 text-sm">
                  Daily Volume & Attendance Trajectory
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="bookings" name="Total Bookings" stroke="#F59E0B" strokeWidth={2.5} />
                      <Line type="monotone" dataKey="checked_in" name="Attended" stroke="#10B981" strokeWidth={2} />
                      <Line type="monotone" dataKey="absent" name="Absent" stroke="#EF4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* REPORT 2: Bookings by Source Channel & Conversion                */}
          {/* ================================================================ */}
          {subView === 'source' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-slate-900 mb-4 text-sm">
                  Source Channel Share (%)
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportData.sources}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {reportData.sources?.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
                <h3 className="font-bold text-slate-900 mb-4 text-sm">
                  Channel Conversion & Performance Matrix
                </h3>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-[11px] text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3 text-right">Booked</th>
                      <th className="py-2.5 px-3 text-right">Share %</th>
                      <th className="py-2.5 px-3 text-right">Attended</th>
                      <th className="py-2.5 px-3 text-right">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.sources?.map((s: any) => (
                      <tr key={s.source} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-800">{s.source}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{s.count}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">{s.percentage}%</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-bold">
                          {s.checked_in + s.completed}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-600 font-extrabold">
                          {s.conversion_rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* REPORT 3: Booking Trends (Line / Bar)                            */}
          {/* ================================================================ */}
          {subView === 'trends' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  Historical Booking Patterns (Appointments vs. Walk-ins)
                </h3>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  {(['day', 'week', 'month'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setTrendGrouping(g)}
                      className={`px-3 py-1 rounded-lg capitalize ${
                        trendGrouping === g ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-600'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="appointments" name="Appointments" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="walk_ins" name="Walk-ins" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="attended" name="Attended" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* REPORT 4: Peak Hours & Weekday Heatmap                           */}
          {/* ================================================================ */}
          {subView === 'peak_hours' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-slate-900 mb-4 text-sm">Hourly Distribution (Peak Slot Times)</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.hourlyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="hour_label" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="bookings_count" name="Patient Count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-slate-900 mb-4 text-sm">Weekday Patient Load</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.weekdayDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="weekday_name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="bookings_count" name="Patient Count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* REPORT 5: Operator & Receptionist Performance                     */}
          {/* ================================================================ */}
          {subView === 'user_perf' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
              <h3 className="font-bold text-slate-900 mb-4 text-sm">Staff Productivity & Booking Attribution</h3>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-extrabold uppercase text-[11px] text-slate-500">
                    <th className="py-2.5 px-3">Staff Member</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3 text-right">Total Bookings</th>
                    <th className="py-2.5 px-3 text-right">Appointments</th>
                    <th className="py-2.5 px-3 text-right">Walk-ins</th>
                    <th className="py-2.5 px-3 text-right">Attended</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((u: any) => (
                    <tr key={u.user_id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{u.full_name} ({u.username})</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{u.bookings_created}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-600">{u.appointments_created}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-600">{u.walkins_created}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-bold">{u.attended_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================================ */}
          {/* REPORT 6: Doctor & Shift Slot Utilisation                         */}
          {/* ================================================================ */}
          {subView === 'doctor_shift' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
              <h3 className="font-bold text-slate-900 mb-4 text-sm">Shift Slot Utilisation & Doctor Workload</h3>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-extrabold uppercase text-[11px] text-slate-500">
                    <th className="py-2.5 px-3">Doctor</th>
                    <th className="py-2.5 px-3">Shift Name</th>
                    <th className="py-2.5 px-3 text-right">Slot Interval</th>
                    <th className="py-2.5 px-3 text-right">Bookings</th>
                    <th className="py-2.5 px-3 text-right">Appointments</th>
                    <th className="py-2.5 px-3 text-right">Walk-ins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((d: any) => (
                    <tr key={d.shift_id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{d.doctor_name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{d.shift_name}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{d.slot_duration_minutes} min</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{d.total_booked}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-600">{d.appointments_count}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-600">{d.walkins_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================================ */}
          {/* REPORT 7: Token Report (A vs W, Reprints, Cancelled)             */}
          {/* ================================================================ */}
          {subView === 'tokens' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Tokens Issued</span>
                  <div className="text-3xl font-black text-slate-900 mt-1">{reportData.totalTokensIssued}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-500">Appointment Tokens (A)</span>
                  <div className="text-3xl font-black text-blue-600 mt-1">{reportData.appointmentTokens}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500">Walk-in Tokens (W)</span>
                  <div className="text-3xl font-black text-amber-500 mt-1">{reportData.walkinTokens}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-500">Reprints Issued</span>
                  <div className="text-3xl font-black text-purple-600 mt-1">{reportData.totalReprints}</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-slate-900 mb-4 text-sm">Daily Token Allocation Breakdown</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.dailyTokens}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="appointment_tokens" name="A-Tokens" fill="#3B82F6" stackId="a" />
                      <Bar dataKey="walkin_tokens" name="W-Tokens" fill="#F59E0B" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* REPORT 8: Absent & Follow-Up Patient Register                     */}
          {/* ================================================================ */}
          {subView === 'absent_followup' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
              <h3 className="font-bold text-slate-900 mb-4 text-sm">
                Absenteeism & Follow-Up Register ({reportData.length} records)
              </h3>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-extrabold uppercase text-[11px] text-slate-500">
                    <th className="py-2.5 px-3">Token</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Patient Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((r: any) => (
                    <tr key={r.booking_id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{r.token_code}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{r.booking_date} ({r.slot_time_formatted})</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{r.first_name} {r.last_name || ''}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{r.full_phone}</td>
                      <td className="py-2.5 px-3">{r.purpose}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'absent' ? 'bg-rose-100 text-rose-800' : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
