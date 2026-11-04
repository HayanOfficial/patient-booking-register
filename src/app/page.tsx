'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { TopTabs, TabKey } from '../components/TopTabs';
import { DateDoctorShiftSelector } from '../components/DateDoctorShiftSelector';
import { ToolbarFilterRow } from '../components/ToolbarFilterRow';
import { StatCards } from '../components/StatCards';
import { BookingTable } from '../components/BookingTable';
import { QuickBookModal } from '../components/QuickBookModal';
import { TokenPrintModal } from '../components/TokenPrintModal';
import { PatientHistoryModal } from '../components/PatientHistoryModal';
import { WaitingListTab } from '../components/WaitingListTab';
import { ReportsTab } from '../components/ReportsTab';
import { UserManagementTab } from '../components/UserManagementTab';
import { SettingsTab } from '../components/SettingsTab';
import { AuditLogTab } from '../components/AuditLogTab';

import {
  Doctor,
  Shift,
  SlotItem,
  Booking,
  DailyStatCardsData,
  ClinicSettings,
  Patient,
  BookingStatus,
  StatCardFilter,
  LookupItem,
  WaitingListItem,
} from '../types';
import { api } from '../services/api';
import { getTodayDateString } from '../utils/dateUtils';
import { SlotEngine } from '../utils/slotEngine';
import { Bell } from 'lucide-react';
import { LoginPage } from '../components/LoginPage';

function BookingRegisterApp() {
  const { user, can } = useAuth();

  // Navigation & Date (Initialized safely for SSR, updated in useEffect)
  const [activeTab, setActiveTab] = useState<TabKey>('booking_sheet');
  const [currentDate, setCurrentDate] = useState<string>('2026-09-29');

  useEffect(() => {
    setCurrentDate(getTodayDateString());
  }, []);

  // Ensure active tab is strictly allowed for current user role
  useEffect(() => {
    if (activeTab === 'user_management' && !can('users.manage')) {
      setActiveTab('booking_sheet');
    } else if (activeTab === 'settings' && !can('settings.manage')) {
      setActiveTab('booking_sheet');
    } else if (activeTab === 'audit_log' && !can('audit.view')) {
      setActiveTab('booking_sheet');
    } else if (
      (activeTab === 'booking_analytics' || activeTab === 'booking_graph' || activeTab === 'monthly_reports') &&
      !can('reports.view')
    ) {
      setActiveTab('booking_sheet');
    }
  }, [user?.role, activeTab, can]);

  // Doctor and Shift State
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [sourcesList, setSourcesList] = useState<LookupItem[]>([]);

  // Bookings & Slots Data
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<DailyStatCardsData | null>(null);
  const [clinicInfo, setClinicInfo] = useState<ClinicSettings | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatFilter, setActiveStatFilter] = useState<StatCardFilter>('all');

  // Realtime Status & Live Toast
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [liveToast, setLiveToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  // Modals
  const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
  const [selectedSlotForBook, setSelectedSlotForBook] = useState<SlotItem | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [isPrintTokenOpen, setIsPrintTokenOpen] = useState(false);
  const [bookingForPrint, setBookingForPrint] = useState<Booking | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [patientForHistory, setPatientForHistory] = useState<Patient | null>(null);

  // Load Initial Metadata (Doctors, Clinic Info, Lookups)
  useEffect(() => {
    async function loadInitial() {
      try {
        const [docs, clinic, srcs] = await Promise.all([
          api.getActiveDoctors(),
          api.getClinicInfo(),
          api.getLookupsByCategory('source'),
        ]);
        setDoctors(docs);
        setClinicInfo(clinic);
        setSourcesList(srcs);

        if (docs.length > 0) {
          const docId = docs[0].id;
          setSelectedDoctorId(docId);
          const docShifts = await api.getShifts(docId);
          setShifts(docShifts);
          if (docShifts.length > 0) {
            setSelectedShiftId(docShifts[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load initial metadata:', err);
      }
    }
    loadInitial();
  }, []);

  // When Doctor changes, update Shifts
  const handleDoctorChange = async (docId: string) => {
    setSelectedDoctorId(docId);
    try {
      const docShifts = await api.getShifts(docId);
      setShifts(docShifts);
      if (docShifts.length > 0) {
        setSelectedShiftId(docShifts[0].id);
      } else {
        setSelectedShiftId('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reload current shift bookings and stat cards
  const loadRegisterData = useCallback(async () => {
    if (!selectedDoctorId || !selectedShiftId) return;
    setIsRefreshing(true);
    try {
      const [fetchedBookings, fetchedStats] = await Promise.all([
        api.getBookingsForShiftAndDate(currentDate, selectedDoctorId, selectedShiftId),
        api.getDailyStats(currentDate, selectedDoctorId, selectedShiftId),
      ]);
      setBookings(fetchedBookings);
      setStats(fetchedStats);
    } catch (err) {
      console.error('Failed to load register data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentDate, selectedDoctorId, selectedShiftId]);

  useEffect(() => {
    loadRegisterData();
  }, [loadRegisterData]);

  // Realtime Subscription Listener
  useEffect(() => {
    const unsubscribe = api.subscribeToRealtime(
      (change) => {
        // Trigger live toast
        if (change.event === 'booking_created') {
          const creator = change.record?.doctor_name ? `Booked for ${change.record.doctor_name}` : 'New booking created';
          setLiveToast({ message: `${change.record?.token_code || 'New Token'}: ${creator}`, visible: true });
          setTimeout(() => setLiveToast({ message: '', visible: false }), 4000);
        }
        // Seamlessly refresh register data
        loadRegisterData();
      },
      (status) => {
        setRealtimeStatus(status);
        if (status === 'connected') {
          loadRegisterData(); // heal missed events
        }
      }
    );

    return () => unsubscribe();
  }, [loadRegisterData]);

  // Keyboard Shortcuts (Quick Book, Refresh)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSelectedSlotForBook(null);
        setEditingBooking(null);
        setIsQuickBookOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        loadRegisterData();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadRegisterData]);

  // Calculate Slots & Apply Filters
  const currentShift = useMemo(() => {
    return shifts.find((s) => s.id === selectedShiftId) || null;
  }, [shifts, selectedShiftId]);

  const currentDoctor = useMemo(() => {
    return doctors.find((d) => d.id === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId]);

  const displaySlots = useMemo(() => {
    if (!currentShift) return [];
    let baseSlots = SlotEngine.generateSlots(currentShift, bookings);

    // Apply Quick Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      baseSlots = baseSlots.filter((slot) => {
        if (!slot.booking) return false;
        const b = slot.booking;
        const p = b.patient;
        return (
          b.token_code.toLowerCase().includes(q) ||
          b.purpose.toLowerCase().includes(q) ||
          b.source.toLowerCase().includes(q) ||
          (p?.first_name && p.first_name.toLowerCase().includes(q)) ||
          (p?.last_name && p.last_name.toLowerCase().includes(q)) ||
          (p?.full_phone && p.full_phone.includes(q)) ||
          (p?.cnic && p.cnic.includes(q))
        );
      });
    }

    // Apply Stat Card Filter
    if (activeStatFilter !== 'all') {
      baseSlots = baseSlots.filter((slot) => {
        if (activeStatFilter === 'available') return !slot.is_booked;
        if (activeStatFilter === 'booked') return slot.is_booked;

        if (!slot.booking) return false;
        const b = slot.booking;

        if (activeStatFilter === 'checked_in') return b.status === 'checked_in';
        if (activeStatFilter === 'in_process') return b.status === 'in_process';
        if (activeStatFilter === 'pending') return b.status === 'pending';
        if (activeStatFilter === 'absent') return b.status === 'absent';
        if (activeStatFilter === 'follow_up') return b.status === 'follow_up' || b.purpose.toLowerCase().includes('follow');
        if (activeStatFilter === 'remaining_fu') return (b.status === 'follow_up' || b.purpose.toLowerCase().includes('follow')) && b.status === 'pending';

        if (activeStatFilter.startsWith('source:')) {
          const src = activeStatFilter.replace('source:', '');
          return b.source === src;
        }

        return true;
      });
    }

    return baseSlots;
  }, [currentShift, bookings, searchQuery, activeStatFilter]);

  // Handler: Click Quick Book on an empty slot
  const handleOpenQuickBookForSlot = (slot: SlotItem) => {
    setSelectedSlotForBook(slot);
    setEditingBooking(null);
    setIsQuickBookOpen(true);
  };

  // Handler: Convert waiting list item to booking
  const handleConvertWaitingToBooking = (item: WaitingListItem) => {
    setSelectedSlotForBook(null);
    setEditingBooking(null);
    setIsQuickBookOpen(true);
  };

  // Handler: Edit Booking
  const handleOpenEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setSelectedSlotForBook({
      slot_index: booking.slot_index,
      slot_time: booking.slot_time,
      slot_time_formatted: booking.slot_time_formatted,
      is_booked: true,
      booking,
    });
    setIsQuickBookOpen(true);
  };

  // Handler: Print Token
  const handleOpenPrintToken = (booking: Booking) => {
    setBookingForPrint(booking);
    setIsPrintTokenOpen(true);
  };

  // Handler: Patient History
  const handleViewPatientHistory = (patient: Patient) => {
    setPatientForHistory(patient);
    setIsHistoryOpen(true);
  };

  // Handler: Status Update
  const handleUpdateStatus = async (bookingId: string, status: BookingStatus) => {
    try {
      await api.updateBookingStatus(
        bookingId,
        status,
        user?.id || 'sys',
        user?.full_name || user?.username || 'user'
      );
      loadRegisterData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Handler: Delete Booking
  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    try {
      await api.softDeleteBooking(
        bookingId,
        user?.id || 'sys',
        user?.full_name || user?.username || 'user'
      );
      loadRegisterData();
    } catch (err) {
      console.error('Failed to delete booking:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      {/* 1. Dark Header */}
      <Header
        currentDate={currentDate}
        realtimeStatus={realtimeStatus}
        onRefresh={loadRegisterData}
        isRefreshing={isRefreshing}
      />

      {/* 2. Top Navigation Tabs */}
      <TopTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Live Toast Notification */}
      {liveToast.visible && (
        <div className="fixed top-14 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xl animate-in slide-in-from-top-2 duration-200">
          <Bell className="w-4 h-4 animate-bounce" />
          <span>{liveToast.message}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto space-y-4">
        {/* ================================================================== */}
        {/* TAB 1: Booking Sheet (Replicating Reference Screenshots)          */}
        {/* ================================================================== */}
        {activeTab === 'booking_sheet' && (
          <div className="space-y-4">
            {/* Date, Doctor & Shift Selector */}
            <DateDoctorShiftSelector
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              doctors={doctors}
              selectedDoctorId={selectedDoctorId}
              onDoctorChange={handleDoctorChange}
              shifts={shifts}
              selectedShiftId={selectedShiftId}
              onShiftChange={setSelectedShiftId}
              onUpdateRegister={loadRegisterData}
              isUpdating={isRefreshing}
            />

            {/* Toolbar: Schedule navigation & quick find search */}
            <ToolbarFilterRow
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClearFilters={() => {
                setSearchQuery('');
                setActiveStatFilter('all');
              }}
            />

            {/* Stat Cards Carousel with click-to-filter */}
            <StatCards
              stats={stats}
              activeFilter={activeStatFilter}
              onFilterChange={setActiveStatFilter}
            />

            {/* Main Booking Register Table */}
            <BookingTable
              slots={displaySlots}
              onQuickBook={handleOpenQuickBookForSlot}
              onEditBooking={handleOpenEditBooking}
              onPrintToken={handleOpenPrintToken}
              onViewHistory={handleViewPatientHistory}
              onUpdateStatus={handleUpdateStatus}
              onDeleteBooking={handleDeleteBooking}
            />
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: Waiting List                                                */}
        {/* ================================================================== */}
        {activeTab === 'waiting_list' && (
          <WaitingListTab
            currentDate={currentDate}
            selectedDoctorId={selectedDoctorId}
            selectedShiftId={selectedShiftId}
            doctors={doctors}
            shifts={shifts}
            onConvertSlot={handleConvertWaitingToBooking}
          />
        )}

        {/* ================================================================== */}
        {/* TAB 3: Reports & Visualizations (Recharts + 8 Reports)             */}
        {/* ================================================================== */}
        {(activeTab === 'booking_analytics' ||
          activeTab === 'booking_graph' ||
          activeTab === 'monthly_reports') && (
          <ReportsTab doctors={doctors} sources={sourcesList} />
        )}

        {/* ================================================================== */}
        {/* TAB 4: User Management (Admin Only)                                */}
        {/* ================================================================== */}
        {activeTab === 'user_management' && <UserManagementTab />}

        {/* ================================================================== */}
        {/* TAB 5: Settings (Admin Only)                                       */}
        {/* ================================================================== */}
        {activeTab === 'settings' && <SettingsTab />}

        {/* ================================================================== */}
        {/* TAB 6: Audit Log (Admin Only)                                      */}
        {/* ================================================================== */}
        {activeTab === 'audit_log' && <AuditLogTab />}
      </main>

      {/* ==================================================================== */}
      {/* MODALS                                                               */}
      {/* ==================================================================== */}
      {/* Quick Book Modal */}
      <QuickBookModal
        isOpen={isQuickBookOpen}
        onClose={() => setIsQuickBookOpen(false)}
        slot={selectedSlotForBook}
        doctor={currentDoctor}
        shift={currentShift}
        clinicInfo={clinicInfo}
        bookingDate={currentDate}
        onBookingSuccess={() => {
          loadRegisterData();
        }}
        editingBooking={editingBooking}
      />

      {/* Token Print Modal */}
      <TokenPrintModal
        isOpen={isPrintTokenOpen}
        onClose={() => setIsPrintTokenOpen(false)}
        booking={bookingForPrint}
        clinicInfo={clinicInfo}
      />

      {/* Patient Visit History Modal */}
      <PatientHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        patient={patientForHistory}
      />
    </div>
  );
}

function MainContent() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1E252B] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Loading Patient Booking Register...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  return <BookingRegisterApp />;
}

export default function Home() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
