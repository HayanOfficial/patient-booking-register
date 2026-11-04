import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { TopTabs, TabKey } from './components/TopTabs';
import { DateDoctorShiftSelector } from './components/DateDoctorShiftSelector';
import { ToolbarFilterRow } from './components/ToolbarFilterRow';
import { StatCards, StatCardFilter } from './components/StatCards';
import { BookingTable } from './components/BookingTable';
import { QuickBookModal } from './components/QuickBookModal';
import { TokenPrintModal } from './components/TokenPrintModal';
import { PatientHistoryModal } from './components/PatientHistoryModal';
import { WaitingListTab } from './components/WaitingListTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { MonthlyPatientReportTab } from './components/MonthlyPatientReportTab';
import { BookingGraphTab } from './components/BookingGraphTab';
import { SettingsTab } from './components/SettingsTab';
import { UserManagementTab } from './components/UserManagementTab';
import { AuditLogTab } from './components/AuditLogTab';
import { BackupRestoreTab } from './components/BackupRestoreTab';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ExtendSlotsModal } from './components/ExtendSlotsModal';

import {
  Doctor,
  Shift,
  SlotItem,
  Booking,
  DailyStatCardsData,
  ClinicSettings,
  Patient,
  BookingStatus,
} from './types';
import { api } from './services/api';
import { getTodayDateString } from './utils/dateUtils';

export const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, mustChangePassword, can } = useAuth();

  // Navigation & Date States
  const [activeTab, setActiveTab] = useState<TabKey>('booking_sheet');
  const [currentDate, setCurrentDate] = useState<string>(getTodayDateString());

  // Doctor and Shift
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');

  // Bookings & Slots Data
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [stats, setStats] = useState<DailyStatCardsData | null>(null);
  const [clinicInfo, setClinicInfo] = useState<ClinicSettings | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatFilter, setActiveStatFilter] = useState<StatCardFilter>('all');

  // Modals
  const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
  const [selectedSlotForBook, setSelectedSlotForBook] = useState<SlotItem | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [waitingItemForBook, setWaitingItemForBook] = useState<any | null>(null);

  const [isPrintTokenOpen, setIsPrintTokenOpen] = useState(false);
  const [bookingForPrint, setBookingForPrint] = useState<Booking | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [patientForHistory, setPatientForHistory] = useState<Patient | null>(null);
  const [isExtendSlotsOpen, setIsExtendSlotsOpen] = useState(false);

  const reloadAppData = async () => {
    try {
      const [docs, clinic] = await Promise.all([
        api.getActiveDoctors(),
        api.getClinicInfo(),
      ]);
      setDoctors(docs);
      setClinicInfo(clinic);

      const targetDocId = docs.some((d) => d.id === selectedDoctorId)
        ? selectedDoctorId
        : docs[0]?.id || '';
      setSelectedDoctorId(targetDocId);

      if (targetDocId) {
        const docShifts = await api.getShifts(targetDocId);
        setShifts(docShifts);
        if (!docShifts.some((s) => s.id === selectedShiftId) && docShifts.length > 0) {
          setSelectedShiftId(docShifts[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to reload app data:', err);
    }
  };

  // Initial Load: Doctors, Shifts, Clinic Settings
  useEffect(() => {
    if (!isAuthenticated) return;
    reloadAppData();
  }, [isAuthenticated]);

  // When Doctor changes, load doctor's shifts
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
      console.error('Failed to load shifts for doctor:', err);
    }
  };

  // Fetch Slots and Stats
  const refreshRegister = useCallback(async () => {
    if (!selectedDoctorId || !selectedShiftId || !currentDate) return;
    setIsRefreshing(true);
    try {
      const [slotData, statsData] = await Promise.all([
        api.getSlotsForShift({
          date: currentDate,
          doctorId: selectedDoctorId,
          shiftId: selectedShiftId,
        }),
        api.getDailyStats({
          date: currentDate,
          doctorId: selectedDoctorId,
          shiftId: selectedShiftId,
        }),
      ]);

      setSlots(slotData.slots || []);
      setStats(statsData || null);
    } catch (err) {
      console.error('Failed to refresh register:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentDate, selectedDoctorId, selectedShiftId]);

  useEffect(() => {
    if (isAuthenticated && selectedDoctorId && selectedShiftId) {
      refreshRegister();
    }
  }, [isAuthenticated, currentDate, selectedDoctorId, selectedShiftId, refreshRegister]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.ctrlKey || e.metaKey || document.activeElement?.tagName !== 'INPUT')) {
        const searchInput = document.querySelector('input[placeholder*="Quick find"]') as HTMLInputElement;
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      } else if (e.key === 't' && (e.altKey || (e.ctrlKey && e.shiftKey))) {
        e.preventDefault();
        setCurrentDate(getTodayDateString());
      } else if (e.key === 'b' && (e.altKey || (e.ctrlKey && e.shiftKey))) {
        e.preventDefault();
        // Open quick book for first available slot
        const firstAvail = slots.find((s) => !s.is_booked);
        if (firstAvail) {
          setSelectedSlotForBook(firstAvail);
          setEditingBooking(null);
          setIsQuickBookOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slots]);

  // Filter slots by search query and stat card selection
  const filteredSlots = useMemo(() => {
    let result = [...slots];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((slot) => {
        if (!slot.is_booked || !slot.booking) return false;
        const b = slot.booking;
        const p = b.patient;
        const name = `${p?.first_name || ''} ${p?.last_name || ''}`.toLowerCase();
        const phone = (p?.full_phone || '').toLowerCase();
        const cnic = (p?.cnic || '').toLowerCase();
        const token = (b.token_code || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || cnic.includes(q) || token.includes(q);
      });
      return result;
    }

    // Stat card filter
    if (activeStatFilter === 'all') {
      return result;
    } else if (activeStatFilter === 'booked') {
      return result.filter((s) => s.is_booked);
    } else if (activeStatFilter === 'available') {
      return result.filter((s) => !s.is_booked);
    } else if (activeStatFilter === 'checked_in') {
      return result.filter((s) => s.booking?.status === 'checked_in');
    } else if (activeStatFilter === 'in_process') {
      return result.filter((s) => s.booking?.status === 'in_process');
    } else if (activeStatFilter === 'pending') {
      return result.filter((s) => s.booking?.status === 'pending');
    } else if (activeStatFilter === 'absent') {
      return result.filter((s) => s.booking?.status === 'absent');
    } else if (activeStatFilter === 'follow_up') {
      return result.filter((s) => s.booking?.purpose === 'Follow Up' || s.booking?.status === 'follow_up');
    } else if (activeStatFilter === 'remaining_fu') {
      return result.filter((s) => s.booking?.purpose === 'Follow Up' && s.booking?.status === 'pending');
    } else if (activeStatFilter.startsWith('source:')) {
      const srcName = activeStatFilter.replace('source:', '');
      return result.filter((s) => s.booking?.source === srcName);
    }

    return result;
  }, [slots, searchQuery, activeStatFilter]);

  // Actions
  const handleQuickBookSlot = (slot: SlotItem) => {
    setSelectedSlotForBook(slot);
    setEditingBooking(null);
    setIsQuickBookOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setSelectedSlotForBook(null);
    setIsQuickBookOpen(true);
  };

  const handlePrintToken = (booking: Booking) => {
    setBookingForPrint(booking);
    setIsPrintTokenOpen(true);
  };

  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      await api.updateBookingStatus({
        bookingId,
        status: newStatus,
        actorUser: { id: user?.id, username: user?.username, role: user?.role },
      });
      refreshRegister();
    } catch (err) {
      console.error('Failed to change booking status:', err);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (window.confirm('Are you sure you want to cancel/delete this booking?')) {
      try {
        await api.deleteBooking({
          bookingId,
          actorUser: { id: user?.id, username: user?.username, role: user?.role },
        });
        refreshRegister();
      } catch (err) {
        console.error('Failed to delete booking:', err);
      }
    }
  };

  const handleBookingConfirmed = (newBooking: Booking) => {
    refreshRegister();
    setWaitingItemForBook(null);
    // Prompt to print token slip
    setBookingForPrint(newBooking);
    setIsPrintTokenOpen(true);
  };

  const handleAssignWaitingToSlot = (item: any) => {
    // Find first available slot
    const firstAvail = slots.find((s) => !s.is_booked);
    if (!firstAvail) {
      alert('No empty slots available in this shift. You can create a walk-in overflow or adjust shift hours.');
      return;
    }
    setActiveTab('booking_sheet');
    setSelectedSlotForBook(firstAvail);
    setWaitingItemForBook(item);
    setEditingBooking(null);
    setIsQuickBookOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1E252B] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-300">Loading Patient Booking Register...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginModal />;
  }

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0] || null;
  const selectedShift = shifts.find((s) => s.id === selectedShiftId) || shifts[0] || null;

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col font-sans select-none">
      {/* 1. Header */}
      <Header currentDate={currentDate} />

      {/* 2. Top Tabs */}
      <TopTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 3. Tab Contents */}
      <main className="flex-1 pb-8">
        {activeTab === 'booking_sheet' && (
          <div className="space-y-0">
            {/* Selector Row */}
            <DateDoctorShiftSelector
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              doctors={doctors}
              selectedDoctorId={selectedDoctorId}
              onDoctorChange={handleDoctorChange}
              shifts={shifts}
              selectedShiftId={selectedShiftId}
              onShiftChange={setSelectedShiftId}
              onRefresh={refreshRegister}
              isRefreshing={isRefreshing}
              onOpenExtendSlots={() => setIsExtendSlotsOpen(true)}
            />

            {/* Toolbar Filter Row */}
            <ToolbarFilterRow
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onResetFilters={() => {
                setSearchQuery('');
                setActiveStatFilter('all');
              }}
            />

            {/* Stat Cards */}
            <StatCards
              stats={stats}
              activeFilter={activeStatFilter}
              onSelectFilter={setActiveStatFilter}
            />

            {/* Main Booking Table */}
            <BookingTable
              slots={filteredSlots}
              onQuickBookSlot={handleQuickBookSlot}
              onEditBooking={handleEditBooking}
              onPrintToken={handlePrintToken}
              onStatusChange={handleStatusChange}
              onDeleteBooking={handleDeleteBooking}
              canEdit={can('bookings.edit')}
              canDelete={can('bookings.delete')}
              canCheckIn={can('bookings.checkin')}
            />
          </div>
        )}

        {activeTab === 'monthly_reports' && (
          <MonthlyPatientReportTab
            doctors={doctors}
            clinicInfo={clinicInfo}
            onViewPatientHistory={(p) => {
              setPatientForHistory(p);
              setIsHistoryOpen(true);
            }}
          />
        )}
        {activeTab === 'booking_analytics' && <AnalyticsTab doctors={doctors} />}
        {activeTab === 'waiting_list' && (
          <WaitingListTab
            currentDate={currentDate}
            doctors={doctors}
            selectedDoctorId={selectedDoctorId}
            onDoctorChange={handleDoctorChange}
            shifts={shifts}
            selectedShiftId={selectedShiftId}
            onShiftChange={setSelectedShiftId}
            onAssignToSlot={handleAssignWaitingToSlot}
          />
        )}
        {activeTab === 'booking_graph' && <BookingGraphTab doctors={doctors} />}
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'settings' && <SettingsTab onSettingsChanged={reloadAppData} />}
        {activeTab === 'audit' && <AuditLogTab />}
        {activeTab === 'backup' && <BackupRestoreTab />}
      </main>

      {/* Quick Book Modal */}
      {isQuickBookOpen && (
        <QuickBookModal
          isOpen={isQuickBookOpen}
          onClose={() => {
            setIsQuickBookOpen(false);
            setSelectedSlotForBook(null);
            setEditingBooking(null);
            setWaitingItemForBook(null);
          }}
          slot={selectedSlotForBook}
          currentDate={currentDate}
          doctor={selectedDoctor}
          shift={selectedShift}
          clinicName={clinicInfo?.name || 'Dr Zarin Medical Center'}
          editingBooking={editingBooking}
          waitingItem={waitingItemForBook}
          onBookingConfirmed={handleBookingConfirmed}
        />
      )}

      {/* Token Print Modal */}
      {isPrintTokenOpen && (
        <TokenPrintModal
          isOpen={isPrintTokenOpen}
          onClose={() => {
            setIsPrintTokenOpen(false);
            setBookingForPrint(null);
          }}
          booking={bookingForPrint}
          clinicInfo={clinicInfo}
        />
      )}

      {/* Patient History Modal */}
      {isHistoryOpen && (
        <PatientHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          patient={patientForHistory}
        />
      )}

      {/* Extend / Adjust Slots Modal */}
      {isExtendSlotsOpen && (
        <ExtendSlotsModal
          isOpen={isExtendSlotsOpen}
          onClose={() => setIsExtendSlotsOpen(false)}
          doctor={selectedDoctor}
          shift={selectedShift}
          onSlotsUpdated={() => {
            reloadAppData();
            refreshRegister();
          }}
        />
      )}

      {/* Forced Password Change on First Login */}
      {mustChangePassword && <ChangePasswordModal />}
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
