import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, Calendar, Clock, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { api } from '../services/api';
import { Doctor } from '../types';
import { useAuth } from '../context/AuthContext';

interface BookingGraphTabProps {
  doctors: Doctor[];
}

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#06B6D4', '#64748B'];

export const BookingGraphTab: React.FC<BookingGraphTabProps> = ({ doctors }) => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchReport = async () => {
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
        console.error('Failed to load graphs data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [startDate, endDate, selectedDoctorId]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header and Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <span>Interactive Booking Visualizations & Graphs</span>
          </h2>
          <p className="text-xs text-slate-500">
            Visual trends, time distribution curves, and source attribution graphs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden font-mono font-bold text-slate-800"
            />
            <span>to</span>
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
        <div className="p-12 text-center text-slate-400 text-xs">Generating graphs...</div>
      ) : report ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trend Line Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <span>Daily Booking Volume Trend</span>
              </h3>
            </div>

            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.dailyTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="bookings" stroke="#F59E0B" strokeWidth={3} name="Total Booked" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="checkedIn" stroke="#10B981" strokeWidth={2} name="Checked-In" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="absent" stroke="#EF4444" strokeWidth={2} name="Absent" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peak Hours Histogram */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>Peak Hours Distribution</span>
              </h3>
            </div>

            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.peakHoursDistribution || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} stroke="#94A3B8" interval={1} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#3B82F6" name="Appointments" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sources Split Bar Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-500" />
              <span>Source Channel Volume</span>
            </h3>

            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.sourceDistribution || []} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <YAxis type="category" dataKey="source" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#F59E0B" name="Bookings" radius={[0, 4, 4, 0]}>
                    {report.sourceDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Purpose Breakdown Pie Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-500" />
              <span>Purpose Breakdown Ratio</span>
            </h3>

            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.purposeDistribution || []}
                    dataKey="count"
                    nameKey="purpose"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {report.purposeDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-p-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', color: '#fff', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
