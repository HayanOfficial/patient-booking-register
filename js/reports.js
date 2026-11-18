// ==============================================================================
// Reports & Analytics Controller
// ==============================================================================
import { requireAuth, logout } from './auth.js';
import { api } from './api.js';
import { todayDateString, offsetDate, getStatusLabel, getStatusClass } from './utils.js';
import Chart from 'chart.js/auto';
import * as XLSX from 'xlsx';

const user = requireAuth();
if (!user) throw new Error('Not authenticated');

const $ = id => document.getElementById(id);

let activeReport = 'overview';
let _charts = {};
let currentReportData = null;

async function init() {
  // Header
  try {
    const c = await api.getClinicInfo();
    if (c?.name) $('hdr-clinic-name').textContent = c.name;
  } catch (err) {
    console.warn('Clinic info fetch failed:', err);
  }

  $('hdr-username').textContent = user.full_name || user.username;
  $('hdr-today-date').textContent = todayDateString();

  // User menu
  $('user-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    $('user-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => $('user-menu')?.classList.remove('open'));
  $('logout-btn').addEventListener('click', () => logout());

  // Default dates: last 30 days
  const today = todayDateString();
  const past30 = offsetDate(today, -29);
  $('rep-start-date').value = past30;
  $('rep-end-date').value = today;

  // Load doctors & sources into filters
  const docs = await api.getAllDoctors();
  const docSelect = $('rep-doctor-select');
  docs.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    docSelect.appendChild(opt);
  });

  const sources = await api.getLookupsByCategory('source');
  const srcSelect = $('rep-source-select');
  sources.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    srcSelect.appendChild(opt);
  });

  // Report tab switching
  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeReport = btn.dataset.report;
      document.querySelectorAll('.report-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.report-panel').forEach(p => p.classList.toggle('active', p.id === `rep-panel-${activeReport}`));
      loadReportData();
    });
  });

  $('rep-filter-btn').addEventListener('click', () => loadReportData());
  $('trend-group-by').addEventListener('change', () => loadReportData());
  $('fu-filter-type').addEventListener('change', () => loadReportData());
  $('rep-export-btn').addEventListener('click', () => exportExcel());

  // Initial load
  loadReportData();
}

async function loadReportData() {
  const startDate = $('rep-start-date').value;
  const endDate   = $('rep-end-date').value;
  const doctorId  = $('rep-doctor-select').value || undefined;
  const source    = $('rep-source-select').value || undefined;

  switch (activeReport) {
    case 'overview':
      await renderOverview(startDate, endDate, doctorId, source);
      break;
    case 'source':
      await renderSource(startDate, endDate, doctorId);
      break;
    case 'trends':
      await renderTrends(startDate, endDate, doctorId);
      break;
    case 'peak':
      await renderPeak(startDate, endDate, doctorId);
      break;
    case 'staff':
      await renderStaff(startDate, endDate);
      break;
    case 'doctor-shift':
      await renderDoctorShift(startDate, endDate);
      break;
    case 'tokens':
      await renderTokens(startDate, endDate, doctorId);
      break;
    case 'followup':
      await renderFollowUp(startDate, endDate, doctorId);
      break;
  }
}

// 1. Overview Report
async function renderOverview(startDate, endDate, doctorId, source) {
  const data = await api.getReportOverview(startDate, endDate, doctorId, source);
  currentReportData = data.dailyTrend || [];

  $('overview-metrics').innerHTML = [
    { label: 'Total Bookings', value: data.totalBookings, sub: 'Filtered Range' },
    { label: 'Attended (Checked In / Done)', value: data.checkedIn + (data.completed || 0), sub: 'Physical Arrivals' },
    { label: 'Absent', value: data.absent, sub: 'Did not show' },
    { label: 'Absenteeism Rate', value: `${data.absentRate}%`, sub: 'No-show benchmark' },
    { label: 'Avg Bookings / Day', value: data.avgPerDay, sub: 'Operating Velocity' },
  ].map(m => `
    <div class="summary-card">
      <div class="s-label">${m.label}</div>
      <div class="s-value">${m.value}</div>
      <div class="s-sub">${m.sub}</div>
    </div>
  `).join('');

  const ctx = $('overview-chart');
  if (ctx && data.dailyTrend) {
    if (_charts.overview) _charts.overview.destroy();
    _charts.overview = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.dailyTrend.map(d => d.date),
        datasets: [
          { label: 'Total Bookings', data: data.dailyTrend.map(d => d.bookings), borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,.15)', fill: true, tension: .3 },
          { label: 'Checked In', data: data.dailyTrend.map(d => d.checked_in), borderColor: '#10B981', backgroundColor: 'transparent', tension: .3 },
          { label: 'Absent', data: data.dailyTrend.map(d => d.absent), borderColor: '#EF4444', backgroundColor: 'transparent', tension: .3 },
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    });
  }
}

// 2. Source Report
async function renderSource(startDate, endDate, doctorId) {
  const data = await api.getReportBookingsBySource(startDate, endDate, doctorId);
  currentReportData = data.sources || [];
  const tbody = $('source-table').querySelector('tbody');
  tbody.innerHTML = (data.sources || []).map(s => `
    <tr>
      <td><strong>${s.source}</strong></td>
      <td>${s.count}</td>
      <td>${s.percentage}%</td>
      <td><span class="badge badge--green">${s.checked_in}</span></td>
      <td><span class="badge badge--blue">${s.completed}</span></td>
      <td><span class="badge badge--red">${s.absent}</span></td>
      <td><strong>${s.conversion_rate}%</strong></td>
    </tr>
  `).join('');
}

// 3. Trends Report
async function renderTrends(startDate, endDate, doctorId) {
  const groupBy = $('trend-group-by').value;
  const data = await api.getReportTrends(startDate, endDate, doctorId, groupBy);
  currentReportData = data;
  const ctx = $('trends-chart');
  if (ctx) {
    if (_charts.trends) _charts.trends.destroy();
    _charts.trends = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.period),
        datasets: [
          { label: 'Appointments (A)', data: data.map(d => d.appointments), backgroundColor: '#3B82F6', borderRadius: 4 },
          { label: 'Walk-ins (W)', data: data.map(d => d.walk_ins), backgroundColor: '#F59E0B', borderRadius: 4 },
        ]
      },
      options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
    });
  }
}

// 4. Peak Hours Report
async function renderPeak(startDate, endDate, doctorId) {
  const data = await api.getReportPeakHours(startDate, endDate, doctorId);
  currentReportData = data.hourlyDistribution || [];
  const hCtx = $('peak-hourly-chart');
  if (hCtx) {
    if (_charts.peakHourly) _charts.peakHourly.destroy();
    _charts.peakHourly = new Chart(hCtx, {
      type: 'bar',
      data: {
        labels: data.hourlyDistribution.map(h => h.hour_label),
        datasets: [{ label: 'Bookings Count', data: data.hourlyDistribution.map(h => h.bookings_count), backgroundColor: '#F59E0B', borderRadius: 4 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  const wCtx = $('peak-weekday-chart');
  if (wCtx) {
    if (_charts.peakWeekday) _charts.peakWeekday.destroy();
    _charts.peakWeekday = new Chart(wCtx, {
      type: 'bar',
      data: {
        labels: data.weekdayDistribution.map(w => w.weekday_name),
        datasets: [{ label: 'Bookings Count', data: data.weekdayDistribution.map(w => w.bookings_count), backgroundColor: '#10B981', borderRadius: 4 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
}

// 5. Staff Performance Report
async function renderStaff(startDate, endDate) {
  const data = await api.getReportUserPerformance(startDate, endDate);
  currentReportData = data;
  const tbody = $('staff-table').querySelector('tbody');
  tbody.innerHTML = data.map(u => `
    <tr>
      <td><strong>${u.full_name || u.username}</strong></td>
      <td><span class="badge badge--gray">${u.role.toUpperCase()}</span></td>
      <td>${u.bookings_created}</td>
      <td>${u.appointments_created}</td>
      <td>${u.walkins_created}</td>
      <td><span class="badge badge--green">${u.attended_count}</span></td>
      <td><span class="badge badge--red">${u.absent_count}</span></td>
    </tr>
  `).join('');
}

// 6. Doctor & Shift Report
async function renderDoctorShift(startDate, endDate) {
  const data = await api.getReportDoctorShift(startDate, endDate);
  currentReportData = data;
  const tbody = $('doctor-shift-table').querySelector('tbody');
  tbody.innerHTML = data.map(d => `
    <tr>
      <td><strong>${d.doctor_name}</strong></td>
      <td>${d.shift_name}</td>
      <td>${d.slot_duration_minutes} min</td>
      <td><strong>${d.total_booked}</strong></td>
      <td>${d.appointments_count}</td>
      <td>${d.walkins_count}</td>
      <td><span class="badge badge--green">${d.completed_count}</span></td>
      <td><span class="badge badge--red">${d.absent_count}</span></td>
    </tr>
  `).join('');
}

// 7. Tokens Report
async function renderTokens(startDate, endDate, doctorId) {
  const data = await api.getReportTokens(startDate, endDate, doctorId);
  currentReportData = data.dailyTokens || [];
  $('tokens-metrics').innerHTML = [
    { label: 'Total Tokens Issued', value: data.totalTokensIssued || 0 },
    { label: 'Token Reprints', value: data.totalReprints || 0 },
    { label: 'Voided / Cancelled', value: data.voidedTokens || 0 },
    { label: 'Average Wait Time', value: data.avgWaitTime || '—' },
  ].map(m => `
    <div class="summary-card">
      <div class="s-label">${m.label}</div>
      <div class="s-value">${m.value}</div>
    </div>
  `).join('');

  const tbody = $('tokens-table').querySelector('tbody');
  tbody.innerHTML = (data.dailyTokens || []).map(t => `
    <tr>
      <td>${t.date}</td>
      <td><strong>#${t.total_tokens}</strong></td>
      <td>${t.reprint_count}</td>
      <td>${t.voided_tokens}</td>
      <td>${t.avg_wait || '—'}</td>
    </tr>
  `).join('');
}

// 8. Follow-up & Absent Report
async function renderFollowUp(startDate, endDate, doctorId) {
  const filterType = $('fu-filter-type').value;
  const data = await api.getReportAbsentAndFollowup(startDate, endDate, doctorId, filterType);
  currentReportData = data;
  const tbody = $('followup-table').querySelector('tbody');
  if (!data.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">No absent or follow-up patients found for this range.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(b => `
    <tr>
      <td>${b.booking_date}</td>
      <td><strong>${b.token_code}</strong></td>
      <td>${b.patient_mrn}</td>
      <td><strong>${b.first_name} ${b.last_name || ''}</strong></td>
      <td>${b.full_phone}</td>
      <td>${b.city || '—'}</td>
      <td>${b.doctor_name}</td>
      <td><span class="status-pill ${getStatusClass(b.status)}" style="font-size:.7rem;padding:2px 8px;">${getStatusLabel(b.status)}</span></td>
      <td>${b.purpose}</td>
      <td style="color:#6b7280;font-size:.78rem;">${b.remarks || '—'}</td>
    </tr>
  `).join('');
}

// --- XLSX Export ---
function exportExcel() {
  if (!currentReportData || !currentReportData.length) {
    alert('No data available to export.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(currentReportData);
  const workbook  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, activeReport.toUpperCase());
  XLSX.writeFile(workbook, `report_${activeReport}_${todayDateString()}.xlsx`);
}

init();

