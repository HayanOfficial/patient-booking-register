import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  UserPlus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Stethoscope,
  Tag,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../services/api';
import { Doctor, Shift, ClinicSettings } from '../types';
import { printHtmlContent } from '../utils/printHelper';

interface MonthlyPatientReportTabProps {
  doctors: Doctor[];
  clinicInfo: ClinicSettings | null;
  onViewPatientHistory?: (patient: any) => void;
}

export const MonthlyPatientReportTab: React.FC<MonthlyPatientReportTabProps> = ({
  doctors,
  clinicInfo,
  onViewPatientHistory,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'date' | 'name' | 'token' | 'status'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const loadMonthlyReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.getMonthlyPatientReport({
        year: selectedYear,
        month: selectedMonth,
        doctorId: selectedDoctorId || undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      });
      setReportData(res);
    } catch (err) {
      console.error('Failed to load monthly patient report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyReport();
  }, [selectedYear, selectedMonth, selectedDoctorId, selectedStatus]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
  };

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    if (!reportData?.records) return [];
    let list = [...reportData.records];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const pName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
        const pPhone = (r.full_phone || r.phone_number || '').toLowerCase();
        const pMrn = (r.patient_mrn || '').toLowerCase();
        const pCnic = (r.cnic || '').toLowerCase();
        const pCity = (r.city || '').toLowerCase();
        const pArea = (r.area || '').toLowerCase();
        const pToken = (r.token_code || '').toLowerCase();
        const pPurpose = (r.purpose || '').toLowerCase();
        const pDoc = (r.doctor_name || '').toLowerCase();
        return (
          pName.includes(q) ||
          pPhone.includes(q) ||
          pMrn.includes(q) ||
          pCnic.includes(q) ||
          pCity.includes(q) ||
          pArea.includes(q) ||
          pToken.includes(q) ||
          pPurpose.includes(q) ||
          pDoc.includes(q)
        );
      });
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        const dateA = `${a.booking_date} ${a.slot_time || ''}`;
        const dateB = `${b.booking_date} ${b.slot_time || ''}`;
        cmp = dateA.localeCompare(dateB);
        if (cmp === 0) cmp = (a.slot_index || 0) - (b.slot_index || 0);
      } else if (sortField === 'name') {
        const nameA = `${a.first_name || ''} ${a.last_name || ''}`;
        const nameB = `${b.first_name || ''} ${b.last_name || ''}`;
        cmp = nameA.localeCompare(nameB);
      } else if (sortField === 'token') {
        cmp = (a.token_number || 0) - (b.token_number || 0);
      } else if (sortField === 'status') {
        cmp = (a.status || '').localeCompare(b.status || '');
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [reportData, searchQuery, sortField, sortAsc]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredRecords || filteredRecords.length === 0) return;
    setIsExporting(true);

    try {
      const headers = [
        'Booking Date',
        'Slot Time',
        'Slot #',
        'Token Code',
        'Patient Name',
        'MRN',
        'Phone',
        'CNIC',
        'Gender',
        'Age',
        'City',
        'Area',
        'Doctor',
        'Shift',
        'Purpose',
        'Reservation Type',
        'Source Channel',
        'Status',
        'Check-In Time',
        'Completed Time',
        'Remarks',
      ];

      const rows = filteredRecords.map((r) => [
        `"${r.booking_date || ''}"`,
        `"${r.slot_time_formatted || r.slot_time || ''}"`,
        `"${r.slot_index || ''}"`,
        `"${r.token_code || ''}"`,
        `"${[r.first_name, r.last_name].filter(Boolean).join(' ')}"`,
        `"${r.patient_mrn || ''}"`,
        `"${r.full_phone || r.phone_number || ''}"`,
        `"${r.cnic || ''}"`,
        `"${r.gender || ''}"`,
        `"${r.age || ''}"`,
        `"${r.city || ''}"`,
        `"${r.area || ''}"`,
        `"${r.doctor_name || ''}"`,
        `"${r.shift_name || ''}"`,
        `"${r.purpose || ''}"`,
        `"${r.reservation_type || ''}"`,
        `"${r.source || ''}"`,
        `"${r.status || ''}"`,
        `"${r.check_in_time || ''}"`,
        `"${r.completed_time || ''}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `Patient_Report_${monthNames[selectedMonth - 1]}_${selectedYear}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Print Full Monthly Report (A4 Format)
  const handlePrintFullReport = async () => {
    if (!reportData) return;

    const clinicName = clinicInfo?.name || 'Dr Zarin Medical Center';
    const clinicAddress = clinicInfo?.address || 'Khyber Medical Centre, Peshawar';
    const clinicPhone = clinicInfo?.phone || '+92-91-5840000';
    const monthTitle = `${monthNames[selectedMonth - 1]} ${selectedYear}`;

    const tableRowsHtml = filteredRecords
      .map(
        (r, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; text-align: left;">
          <td style="padding: 5px 6px; font-mono; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 5px 6px;">${r.booking_date}</td>
          <td style="padding: 5px 6px; font-weight: bold; color: #b45309;">${r.token_code}</td>
          <td style="padding: 5px 6px; font-weight: bold;">${[r.first_name, r.last_name].filter(Boolean).join(' ')}</td>
          <td style="padding: 5px 6px; font-mono;">${r.patient_mrn || '-'}</td>
          <td style="padding: 5px 6px; font-mono;">${r.full_phone || '-'}</td>
          <td style="padding: 5px 6px;">${[r.area, r.city].filter(Boolean).join(', ') || '-'}</td>
          <td style="padding: 5px 6px;">${r.doctor_name || 'Dr Zarin'}</td>
          <td style="padding: 5px 6px;">${r.purpose} (${r.reservation_type})</td>
          <td style="padding: 5px 6px; font-weight: bold; text-transform: uppercase;">${r.status}</td>
        </tr>
      `
      )
      .join('');

    const printableHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 10px;">
        <!-- Report Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">${clinicName}</h1>
            <p style="margin: 3px 0 0; font-size: 11px; color: #475569;">${clinicAddress} &bull; Ph: ${clinicPhone}</p>
            <h2 style="margin: 8px 0 0; font-size: 15px; font-weight: 800; color: #b45309;">
              MONTHLY PATIENT REGISTER & OPERATIONAL REPORT &mdash; ${monthTitle}
            </h2>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div><strong>Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
            <div><strong>Filter:</strong> ${selectedDoctorId ? doctors.find((d) => d.id === selectedDoctorId)?.name : 'All Doctors'}</div>
            <div><strong>Records:</strong> ${filteredRecords.length} patients</div>
          </div>
        </div>

        <!-- Monthly KPI Summary Bar -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 18px; background: #f8fafc; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
          <div style="text-align: center;">
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Total Bookings</div>
            <div style="font-size: 20px; font-weight: 900; color: #0f172a;">${reportData.totalBookings}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Unique Patients</div>
            <div style="font-size: 20px; font-weight: 900; color: #0284c7;">${reportData.uniquePatientsCount}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Completed Visits</div>
            <div style="font-size: 20px; font-weight: 900; color: #16a34a;">${reportData.completedCount}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Attendance Rate</div>
            <div style="font-size: 20px; font-weight: 900; color: #16a34a;">${reportData.attendanceRate}%</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Absent / No-Show</div>
            <div style="font-size: 20px; font-weight: 900; color: #dc2626;">${reportData.absentCount} (${reportData.absentRate}%)</div>
          </div>
        </div>

        <!-- Patient Roster Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 10px; text-transform: uppercase; text-align: left;">
              <th style="padding: 6px;">#</th>
              <th style="padding: 6px;">Date</th>
              <th style="padding: 6px;">Token</th>
              <th style="padding: 6px;">Patient Name</th>
              <th style="padding: 6px;">MRN</th>
              <th style="padding: 6px;">Phone</th>
              <th style="padding: 6px;">City / Area</th>
              <th style="padding: 6px;">Doctor</th>
              <th style="padding: 6px;">Purpose</th>
              <th style="padding: 6px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="10" style="text-align: center; padding: 20px;">No patient records found for this month.</td></tr>'}
          </tbody>
        </table>

        <!-- Signatures and Verification -->
        <div style="margin-top: 30px; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 16px; font-size: 11px;">
          <div>
            <p style="margin: 0; font-weight: bold;">Prepared by: Reception & Medical Records</p>
            <p style="margin: 2px 0 0; color: #64748b;">Dr Zarin Medical Center Schedule System</p>
          </div>
          <div style="text-align: right; width: 220px;">
            <div style="border-bottom: 1px dashed #0f172a; margin-bottom: 6px; height: 35px;"></div>
            <p style="margin: 0; font-weight: bold;">Doctor / Medical Director Signature</p>
          </div>
        </div>
      </div>
    `;

    await printHtmlContent(printableHtml, {
      format: 'a4',
      title: `Monthly-Patient-Report-${selectedYear}-${selectedMonth}`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'checked_in':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" /> Checked In
          </span>
        );
      case 'in_process':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            <Stethoscope className="w-3 h-3" /> In Process
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3" /> Absent
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            Pending
          </span>
        );
    }
  };

  // Highest daily volume for chart scaling
  const maxDayBookings = useMemo(() => {
    if (!reportData?.dailyActivity) return 1;
    return Math.max(1, ...reportData.dailyActivity.map((d: any) => d.bookings));
  }, [reportData]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header & Month Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span>Monthly Patient Register & Complete Reports</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View, filter, analyze, export and print complete patient appointments, visit trends, and records by month.
          </p>
        </div>

        {/* Action Buttons: Print Report & CSV */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadMonthlyReport}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExporting || !reportData || filteredRecords.length === 0}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV / Excel</span>
          </button>

          <button
            onClick={handlePrintFullReport}
            disabled={isLoading || !reportData || filteredRecords.length === 0}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print Monthly Report (A4)</span>
          </button>
        </div>
      </div>

      {/* Month & Filter Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-slate-900 tracking-wide">
              {monthNames[selectedMonth - 1]} {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleCurrentMonth}
            className="px-3 py-1.5 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 text-xs font-bold rounded-xl transition"
          >
            This Month
          </button>

          {/* Month Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          >
            {monthNames.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Doctor & Status Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs">
            <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden font-bold text-slate-800 cursor-pointer"
            >
              <option value="">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden font-bold text-slate-800 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="checked_in">Checked In</option>
              <option value="in_process">In Process</option>
              <option value="absent">Absent / No-Show</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Loading monthly report & patient register...</p>
        </div>
      ) : reportData ? (
        <>
          {/* Monthly KPI Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Bookings
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900 font-mono">
                  {reportData.totalBookings}
                </span>
                <span className="text-[11px] text-slate-400 font-bold">in {monthNames[selectedMonth - 1]}</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
                <span>Appointments: <b>{reportData.appointmentCount}</b></span>
                <span>Walk-ins: <b>{reportData.walkinCount}</b></span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                Unique Patients
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-blue-700 font-mono">
                  {reportData.uniquePatientsCount}
                </span>
                <span className="text-[11px] text-blue-600 font-bold">individuals</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
                <span>New: <b className="text-emerald-600">{reportData.newPatientsCount}</b></span>
                <span>Returning: <b>{reportData.returningPatientsCount}</b></span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                Attended & Completed
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-emerald-600 font-mono">
                  {reportData.completedCount}
                </span>
                <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {reportData.attendanceRate}%
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                <span>Successful clinic visits</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
                Absent / No-Shows
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-rose-600 font-mono">
                  {reportData.absentCount}
                </span>
                <span className="text-[11px] font-black text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                  {reportData.absentRate}%
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                <span>Missed slot opportunities</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                Top Source Channel
              </span>
              <div className="mt-1">
                <span className="text-xl font-black text-amber-800 truncate block">
                  {reportData.sourceBreakdown[0]?.source || 'None'}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">
                  {reportData.sourceBreakdown[0]?.count || 0} patients ({reportData.sourceBreakdown[0]?.percentage || 0}%)
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                <span>Primary acquisition channel</span>
              </div>
            </div>
          </div>

          {/* Daily Trend Activity Graph across the Month */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <span>Daily Patient Activity & Attendance &mdash; {monthNames[selectedMonth - 1]} {selectedYear}</span>
              </h3>
              <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                  <span>Total Bookings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                  <span>Absent</span>
                </div>
              </div>
            </div>

            {/* Daily Column Chart */}
            <div className="pt-4 pb-2 overflow-x-auto no-scrollbar">
              <div className="flex items-end gap-1.5 h-36 min-w-[700px]">
                {reportData.dailyActivity.map((day: any) => {
                  const barHeightPct = day.bookings > 0 ? Math.max(8, (day.bookings / maxDayBookings) * 100) : 4;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center group relative min-w-[20px]"
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap pointer-events-none">
                        <span>
                          <b>Day {day.dayNumber} ({day.dayName}):</b> {day.bookings} Bookings
                        </span>
                        <span className="text-[9px] text-slate-300">
                          {day.completed} Attended &bull; {day.absent} Absent
                        </span>
                      </div>

                      {/* Bar Stack */}
                      <div className="w-full bg-slate-100 rounded-t overflow-hidden flex flex-col justify-end" style={{ height: '110px' }}>
                        <div
                          className={`w-full transition-all duration-300 rounded-t ${
                            day.bookings > 0 ? 'bg-amber-500 group-hover:bg-amber-600' : 'bg-slate-200'
                          }`}
                          style={{ height: `${barHeightPct}%` }}
                        />
                      </div>

                      {/* Day Label */}
                      <span className="text-[10px] font-mono font-bold text-slate-600 mt-1">
                        {day.dayNumber}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Demographic & Source Breakdowns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Source Channel Distribution */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-blue-500" />
                <span>Patient Acquisition Channels</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {reportData.sourceBreakdown.map((s: any) => (
                  <div key={s.source} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-800">{s.source}</span>
                      <span className="text-slate-500">{s.count} ({s.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${s.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visit Purpose Distribution */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-500" />
                <span>Visit Purpose / Clinical Category</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {reportData.purposeBreakdown.map((p: any) => (
                  <div key={p.purpose} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-800">{p.purpose}</span>
                      <span className="text-slate-500">{p.count} ({p.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${p.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Geographic Distribution */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>Top Patient Locations / Cities</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {reportData.cityBreakdown.map((c: any) => (
                  <div key={c.city} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-800">{c.city}</span>
                      <span className="text-slate-500">{c.count} ({c.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${c.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full Monthly Patient Records Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            {/* Table Header & Search Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Complete Patient Register &mdash; {monthNames[selectedMonth - 1]} {selectedYear}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-mono font-bold">
                  {filteredRecords.length} records
                </span>
              </div>

              {/* Live Search Box */}
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, MRN, phone, CNIC, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                      onClick={() => {
                        if (sortField === 'date') setSortAsc(!sortAsc);
                        else {
                          setSortField('date');
                          setSortAsc(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Date & Time</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                      onClick={() => {
                        if (sortField === 'token') setSortAsc(!sortAsc);
                        else {
                          setSortField('token');
                          setSortAsc(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Token</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                      onClick={() => {
                        if (sortField === 'name') setSortAsc(!sortAsc);
                        else {
                          setSortField('name');
                          setSortAsc(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Patient Info</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Doctor & Shift</th>
                    <th className="py-2.5 px-3">Purpose & Type</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition"
                      onClick={() => {
                        if (sortField === 'status') setSortAsc(!sortAsc);
                        else {
                          setSortField('status');
                          setSortAsc(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        No patient records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r, idx) => (
                      <tr
                        key={r.id}
                        className="hover:bg-amber-50/40 transition group cursor-default"
                        onClick={() => onViewPatientHistory && r.patient_id && onViewPatientHistory({ id: r.patient_id, first_name: r.first_name, last_name: r.last_name })}
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{r.booking_date}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{r.slot_time_formatted || r.slot_time}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-1 bg-amber-100 text-amber-950 font-black font-mono rounded border border-amber-300">
                            {r.token_code}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Slot #{r.slot_index}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">
                            {[r.first_name, r.last_name].filter(Boolean).join(' ')}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            {r.patient_mrn && <span className="text-amber-700 font-semibold">MRN: {r.patient_mrn}</span>}
                            {r.age && <span>&bull; {r.age} yrs</span>}
                            {r.gender && <span>&bull; {r.gender}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-700">
                          {r.full_phone || r.phone_number || '-'}
                          {r.cnic && <span className="block text-[10px] text-slate-400">CNIC: {r.cnic}</span>}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                          {[r.area, r.city].filter(Boolean).join(', ') || '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{r.doctor_name || 'Dr Zarin'}</div>
                          <div className="text-[11px] text-slate-500">{r.shift_name || 'Standard'}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-medium text-slate-800">{r.purpose}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{r.reservation_type}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium border border-slate-200">
                            {r.source || 'Direct'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {getStatusBadge(r.status)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={r.remarks}>
                          {r.remarks || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
              <span>
                Showing <b>{filteredRecords.length}</b> of <b>{reportData.totalBookings}</b> monthly patient bookings
              </span>
              <span className="text-[11px] text-slate-400">
                Click any row to view visit history.
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
