import { BookingRepository } from '../repositories/booking.repository';
import { ShiftRepository } from '../repositories/doctor.repository';
import { LookupRepository } from '../repositories/lookup.repository';
import { SlotEngine } from './slot-engine';
import { DailyStatCardsData, Booking } from '../../src/types';

export class AnalyticsService {
  private bookingRepo: BookingRepository;
  private shiftRepo: ShiftRepository;
  private lookupRepo: LookupRepository;

  constructor() {
    this.bookingRepo = new BookingRepository();
    this.shiftRepo = new ShiftRepository();
    this.lookupRepo = new LookupRepository();
  }

  public getDailyStats(date: string, doctorId: string, shiftId: string): DailyStatCardsData {
    const shift = this.shiftRepo.findById(shiftId);
    const bookings = this.bookingRepo.getBookingsForShiftAndDate(date, doctorId, shiftId);
    
    // Total potential slots in the shift
    let totalSlots = 94; // fallback
    if (shift) {
      const slots = SlotEngine.generateSlots(shift, []);
      totalSlots = slots.length;
    }

    const activeBookings = bookings.filter((b) => !b.deleted_at && b.status !== 'cancelled');
    const totalBookings = activeBookings.length;
    const bookedSlots = totalBookings;
    const availableSlots = Math.max(0, totalSlots - bookedSlots);

    const bookedPercentage = totalSlots > 0 ? Number(((bookedSlots / totalSlots) * 100).toFixed(1)) : 0;
    const availablePercentage = totalSlots > 0 ? Number(((availableSlots / totalSlots) * 100).toFixed(1)) : 0;

    let checkInCount = 0;
    let inProcessCount = 0;
    let pendingCount = 0;
    let absentCount = 0;
    let followUpCount = 0;
    let remainingFollowUpCount = 0;
    const sourcesCount: Record<string, number> = {};

    // Initialize all active sources
    const activeSources = this.lookupRepo.getByCategory('source', true);
    for (const s of activeSources) {
      sourcesCount[s.name] = 0;
    }

    for (const b of activeBookings) {
      if (b.status === 'checked_in') checkInCount++;
      else if (b.status === 'in_process') inProcessCount++;
      else if (b.status === 'pending') pendingCount++;
      else if (b.status === 'absent') absentCount++;
      else if (b.status === 'follow_up' || b.purpose === 'Follow Up') followUpCount++;

      if (b.purpose === 'Follow Up' && b.status === 'pending') {
        remainingFollowUpCount++;
      }

      if (b.source) {
        sourcesCount[b.source] = (sourcesCount[b.source] || 0) + 1;
      }
    }

    const checkInPercentage = totalBookings > 0 ? Number(((checkInCount / totalBookings) * 100).toFixed(1)) : 0;
    const inProcessPercentage = totalBookings > 0 ? Number(((inProcessCount / totalBookings) * 100).toFixed(1)) : 0;
    const pendingPercentage = totalBookings > 0 ? Number(((pendingCount / totalBookings) * 100).toFixed(1)) : 0;
    const absentPercentage = totalBookings > 0 ? Number(((absentCount / totalBookings) * 100).toFixed(1)) : 0;
    const followUpPercentage = totalBookings > 0 ? Number(((followUpCount / totalBookings) * 100).toFixed(1)) : 0;
    const remainingFollowUpPercentage =
      followUpCount > 0 ? Number(((remainingFollowUpCount / followUpCount) * 100).toFixed(1)) : (totalBookings > 0 ? 100.0 : 0);

    return {
      totalBookings,
      bookedSlots,
      totalSlots,
      bookedPercentage,
      availableSlots,
      availablePercentage,
      checkInCount,
      checkInPercentage,
      inProcessCount,
      inProcessPercentage,
      pendingCount,
      pendingPercentage,
      absentCount,
      absentPercentage,
      followUpCount,
      followUpPercentage,
      remainingFollowUpCount,
      remainingFollowUpPercentage,
      sourcesCount,
    };
  }

  public getFullAnalyticsReport(startDate: string, endDate: string, doctorId?: string): {
    totalBookings: number;
    completedCount: number;
    absentCount: number;
    absentRate: number;
    sourceDistribution: { source: string; count: number; percentage: number }[];
    purposeDistribution: { purpose: string; count: number; percentage: number }[];
    peakHoursDistribution: { hour: string; count: number }[];
    dailyTrend: { date: string; bookings: number; checkedIn: number; absent: number }[];
  } {
    let sql = `
      SELECT * FROM bookings
      WHERE (deleted_at IS NULL OR deleted_at = '')
        AND booking_date >= ? AND booking_date <= ?
    `;
    const params: any[] = [startDate, endDate];
    if (doctorId) {
      sql += ` AND doctor_id = ?`;
      params.push(doctorId);
    }
    sql += ` ORDER BY booking_date ASC, slot_time ASC`;

    const allBookings = this.bookingRepo['dbWrapper'].all<Booking>(sql, params);
    const totalBookings = allBookings.length;

    let completedCount = 0;
    let absentCount = 0;
    const sourceMap = new Map<string, number>();
    const purposeMap = new Map<string, number>();
    const hourMap = new Map<number, number>();
    const dailyMap = new Map<string, { bookings: number; checkedIn: number; absent: number }>();

    for (let h = 8; h <= 20; h++) {
      hourMap.set(h, 0);
    }

    for (const b of allBookings) {
      if (b.status === 'completed' || b.status === 'checked_in') completedCount++;
      if (b.status === 'absent') absentCount++;

      // Source
      const src = b.source || 'Other';
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1);

      // Purpose
      const purp = b.purpose || 'General';
      purposeMap.set(purp, (purposeMap.get(purp) || 0) + 1);

      // Peak hour
      if (b.slot_time) {
        const hour = parseInt(b.slot_time.split(':')[0], 10);
        if (!isNaN(hour)) {
          hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
        }
      }

      // Daily trend
      if (!dailyMap.has(b.booking_date)) {
        dailyMap.set(b.booking_date, { bookings: 0, checkedIn: 0, absent: 0 });
      }
      const dayStats = dailyMap.get(b.booking_date)!;
      dayStats.bookings++;
      if (b.status === 'checked_in' || b.status === 'completed' || b.status === 'in_process') dayStats.checkedIn++;
      if (b.status === 'absent') dayStats.absent++;
    }

    const absentRate = totalBookings > 0 ? Number(((absentCount / totalBookings) * 100).toFixed(1)) : 0;

    const sourceDistribution = Array.from(sourceMap.entries()).map(([source, count]) => ({
      source,
      count,
      percentage: totalBookings > 0 ? Number(((count / totalBookings) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count);

    const purposeDistribution = Array.from(purposeMap.entries()).map(([purpose, count]) => ({
      purpose,
      count,
      percentage: totalBookings > 0 ? Number(((count / totalBookings) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count);

    const peakHoursDistribution = Array.from(hourMap.entries()).map(([hour, count]) => ({
      hour: SlotEngine.formatTime12h(hour * 60),
      count,
    }));

    const dailyTrend = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      bookings: stats.bookings,
      checkedIn: stats.checkedIn,
      absent: stats.absent,
    }));

    return {
      totalBookings,
      completedCount,
      absentCount,
      absentRate,
      sourceDistribution,
      purposeDistribution,
      peakHoursDistribution,
      dailyTrend,
    };
  }

  /**
   * Get detailed monthly patient register report with complete data and analytics dashboard
   */
  public getMonthlyPatientReport(params: {
    year: number;
    month: number; // 1-12
    doctorId?: string;
    shiftId?: string;
    status?: string;
  }): {
    monthString: string;
    year: number;
    month: number;
    startDate: string;
    endDate: string;
    totalBookings: number;
    uniquePatientsCount: number;
    newPatientsCount: number;
    returningPatientsCount: number;
    completedCount: number;
    absentCount: number;
    pendingCount: number;
    cancelledCount: number;
    walkinCount: number;
    appointmentCount: number;
    attendanceRate: number;
    absentRate: number;
    dailyActivity: {
      date: string;
      dayNumber: number;
      dayName: string;
      bookings: number;
      completed: number;
      absent: number;
      walkin: number;
      appointment: number;
    }[];
    doctorBreakdown: { doctorId: string; doctorName: string; count: number; completed: number; percentage: number }[];
    sourceBreakdown: { source: string; count: number; percentage: number }[];
    purposeBreakdown: { purpose: string; count: number; percentage: number }[];
    cityBreakdown: { city: string; count: number; percentage: number }[];
    records: any[];
  } {
    const { year, month, doctorId, shiftId, status } = params;
    const padMonth = month.toString().padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${padMonth}-01`;
    const endDate = `${year}-${padMonth}-${lastDay.toString().padStart(2, '0')}`;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const monthString = `${monthNames[month - 1]} ${year}`;

    let sql = `
      SELECT 
        b.id, b.booking_date, b.slot_index, b.slot_time, b.slot_time_formatted,
        b.token_number, b.token_code, b.purpose, b.reservation_type, b.source,
        b.called_as, b.status, b.remarks, b.created_at, b.check_in_time,
        b.in_process_time, b.completed_time, b.doctor_id, b.shift_id,
        p.id as patient_id, p.patient_mrn, p.first_name, p.last_name,
        p.full_phone, p.phone_code, p.phone_prefix, p.phone_number,
        p.cnic, p.gender, p.age, p.dob, p.city, p.area, p.address,
        p.created_at as patient_created_at,
        d.name as doctor_name,
        s.name as shift_name
      FROM bookings b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN shifts s ON b.shift_id = s.id
      WHERE (b.deleted_at IS NULL OR b.deleted_at = '')
        AND b.booking_date >= ? AND b.booking_date <= ?
    `;
    const queryParams: any[] = [startDate, endDate];

    if (doctorId) {
      sql += ` AND b.doctor_id = ?`;
      queryParams.push(doctorId);
    }
    if (shiftId) {
      sql += ` AND b.shift_id = ?`;
      queryParams.push(shiftId);
    }
    if (status && status !== 'all') {
      sql += ` AND b.status = ?`;
      queryParams.push(status);
    }

    sql += ` ORDER BY b.booking_date ASC, b.slot_index ASC, b.slot_time ASC`;

    const rawRecords = this.bookingRepo['dbWrapper'].all<any>(sql, queryParams);
    const totalBookings = rawRecords.length;

    // Metrics calculations
    const uniquePatientIds = new Set<string>();
    let completedCount = 0;
    let absentCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let walkinCount = 0;
    let appointmentCount = 0;
    let newPatientsCount = 0;
    let returningPatientsCount = 0;

    const sourceMap = new Map<string, number>();
    const purposeMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    const docMap = new Map<string, { doctorId: string; doctorName: string; count: number; completed: number }>();

    // Daily breakdown for all days of the month (1..lastDay)
    const dailyMap = new Map<string, {
      date: string;
      dayNumber: number;
      dayName: string;
      bookings: number;
      completed: number;
      absent: number;
      walkin: number;
      appointment: number;
    }>();

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${padMonth}-${day.toString().padStart(2, '0')}`;
      const dObj = new Date(year, month - 1, day);
      const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
      dailyMap.set(dateStr, {
        date: dateStr,
        dayNumber: day,
        dayName,
        bookings: 0,
        completed: 0,
        absent: 0,
        walkin: 0,
        appointment: 0,
      });
    }

    for (const r of rawRecords) {
      if (r.patient_id) {
        uniquePatientIds.add(r.patient_id);
      }

      // Check new vs returning patient (created in this month or earlier)
      if (r.patient_created_at && r.patient_created_at.startsWith(`${year}-${padMonth}`)) {
        newPatientsCount++;
      } else {
        returningPatientsCount++;
      }

      if (r.status === 'completed' || r.status === 'checked_in' || r.status === 'in_process') {
        completedCount++;
      } else if (r.status === 'absent') {
        absentCount++;
      } else if (r.status === 'cancelled') {
        cancelledCount++;
      } else {
        pendingCount++;
      }

      if (r.reservation_type === 'Walk-in') {
        walkinCount++;
      } else {
        appointmentCount++;
      }

      // Source
      const src = r.source || 'Direct / Self';
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1);

      // Purpose
      const purp = r.purpose || 'General Consultation';
      purposeMap.set(purp, (purposeMap.get(purp) || 0) + 1);

      // City
      const city = r.city || 'Peshawar';
      cityMap.set(city, (cityMap.get(city) || 0) + 1);

      // Doctor
      const docName = r.doctor_name || 'Dr Zarin';
      const docKey = r.doctor_id || 'default-doc';
      if (!docMap.has(docKey)) {
        docMap.set(docKey, { doctorId: docKey, doctorName: docName, count: 0, completed: 0 });
      }
      const docObj = docMap.get(docKey)!;
      docObj.count++;
      if (r.status === 'completed' || r.status === 'checked_in') {
        docObj.completed++;
      }

      // Daily
      const dayEntry = dailyMap.get(r.booking_date);
      if (dayEntry) {
        dayEntry.bookings++;
        if (r.status === 'completed' || r.status === 'checked_in' || r.status === 'in_process') {
          dayEntry.completed++;
        }
        if (r.status === 'absent') {
          dayEntry.absent++;
        }
        if (r.reservation_type === 'Walk-in') {
          dayEntry.walkin++;
        } else {
          dayEntry.appointment++;
        }
      }
    }

    const attendanceRate = totalBookings > 0 ? Number(((completedCount / totalBookings) * 100).toFixed(1)) : 0;
    const absentRate = totalBookings > 0 ? Number(((absentCount / totalBookings) * 100).toFixed(1)) : 0;

    const sourceBreakdown = Array.from(sourceMap.entries()).map(([source, count]) => ({
      source,
      count,
      percentage: totalBookings > 0 ? Number(((count / totalBookings) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count);

    const purposeBreakdown = Array.from(purposeMap.entries()).map(([purpose, count]) => ({
      purpose,
      count,
      percentage: totalBookings > 0 ? Number(((count / totalBookings) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count);

    const cityBreakdown = Array.from(cityMap.entries()).map(([city, count]) => ({
      city,
      count,
      percentage: totalBookings > 0 ? Number(((count / totalBookings) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count);

    const doctorBreakdown = Array.from(docMap.values()).map((d) => ({
      ...d,
      percentage: totalBookings > 0 ? Number(((d.count / totalBookings) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count);

    return {
      monthString,
      year,
      month,
      startDate,
      endDate,
      totalBookings,
      uniquePatientsCount: uniquePatientIds.size,
      newPatientsCount,
      returningPatientsCount,
      completedCount,
      absentCount,
      pendingCount,
      cancelledCount,
      walkinCount,
      appointmentCount,
      attendanceRate,
      absentRate,
      dailyActivity: Array.from(dailyMap.values()),
      doctorBreakdown,
      sourceBreakdown,
      purposeBreakdown,
      cityBreakdown,
      records: rawRecords,
    };
  }
}
