'use client';

import React from 'react';
import {
  User,
  Phone,
  MapPin,
  Cake,
  Tag,
  Target,
  CheckCircle2,
  Clock,
  Printer,
  Edit2,
  Trash2,
  PhoneCall,
  CalendarPlus,
  AlertCircle,
  Play,
  Check,
  UserCheck,
} from 'lucide-react';
import { SlotItem, Booking, BookingStatus } from '../types';
import { useAuth } from '../context/AuthContext';

interface BookingTableProps {
  slots: SlotItem[];
  onQuickBook: (slot: SlotItem) => void;
  onEditBooking: (booking: Booking) => void;
  onPrintToken: (booking: Booking) => void;
  onViewHistory: (patient: any) => void;
  onUpdateStatus: (bookingId: string, status: BookingStatus) => void;
  onDeleteBooking: (bookingId: string) => void;
}

export const BookingTable: React.FC<BookingTableProps> = ({
  slots,
  onQuickBook,
  onEditBooking,
  onPrintToken,
  onViewHistory,
  onUpdateStatus,
  onDeleteBooking,
}) => {
  const { can, role } = useAuth();
  const isAdmin = role === 'admin';
  const isReceptionist = role === 'receptionist';
  const isOperator = role === 'operator';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
              <th className="py-3 px-4 w-12 text-center">SR#</th>
              <th className="py-3 px-4 w-28">TIME</th>
              <th className="py-3 px-6">PATIENT IDENTIFICATION</th>
              <th className="py-3 px-4 w-32">SOURCE</th>
              <th className="py-3 px-4 w-36">PURPOSE</th>
              <th className="py-3 px-4 w-36">APPOINTMENT</th>
              <th className="py-3 px-4 w-40 text-center">VISIT INFO</th>
              <th className="py-3 px-4 w-44 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {slots.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No slots generated for this shift and date.
                </td>
              </tr>
            ) : (
              slots.map((slot) => {
                const b = slot.booking;

                // ------------------------------------------------------------
                // CASE 1: EMPTY SLOT -> Render "+ Quick Book Slot"
                // ------------------------------------------------------------
                if (!slot.is_booked || !b) {
                  return (
                    <tr
                      key={`empty-${slot.slot_index}`}
                      className="hover:bg-amber-50/20 transition-colors group"
                    >
                      {/* SR# */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                        {slot.slot_index}
                      </td>

                      {/* Time pill */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-3 py-1 bg-amber-50/80 border border-amber-300/80 rounded-xl font-bold text-amber-900 shadow-xs whitespace-nowrap">
                          {slot.slot_time_formatted}
                        </span>
                      </td>

                      {/* Wide span with centered + Quick Book Slot button */}
                      <td colSpan={6} className="py-3 px-6 text-center">
                        <button
                          onClick={() => onQuickBook(slot)}
                          className="inline-flex items-center justify-center gap-2 px-6 py-1.5 border border-[#F59E0B] rounded-xl text-amber-700 font-bold text-xs hover:bg-[#F59E0B] hover:text-slate-950 transition-all shadow-xs cursor-pointer group-hover:shadow-md"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          <span>Quick Book Slot</span>
                        </button>
                      </td>
                    </tr>
                  );
                }

                // ------------------------------------------------------------
                // CASE 2: BOOKED SLOT
                // ------------------------------------------------------------
                const p = b.patient;
                const patientName = p ? `${p.first_name} ${p.last_name || ''}`.trim() : 'Patient';

                return (
                  <tr
                    key={b.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      b.status === 'absent' ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    {/* SR# */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                      {slot.slot_index}
                    </td>

                    {/* Time pill matching screenshot */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-3 py-1 bg-amber-50/80 border border-amber-300/80 rounded-xl font-bold text-amber-900 shadow-xs whitespace-nowrap">
                        {slot.slot_time_formatted}
                      </span>
                    </td>

                    {/* Patient Identification */}
                    <td className="py-3 px-6">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mt-0.5 flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              onClick={() => p && onViewHistory(p)}
                              className="font-bold text-slate-900 hover:text-amber-600 cursor-pointer"
                            >
                              {patientName}
                            </span>
                            <span className="px-2 py-0.5 bg-[#0284C7] text-white text-[10px] font-bold rounded-md">
                              {b.called_as || 'Hospital Patient'}
                            </span>
                            {/* Token Code Badge */}
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-mono font-extrabold border border-amber-300">
                              {b.token_code}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                            {p?.full_phone && (
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{p.full_phone}</span>
                              </span>
                            )}
                            {(p?.area || p?.city) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-rose-500" />
                                <span>{[p.area, p.city].filter(Boolean).join(', ')}</span>
                              </span>
                            )}
                            {p?.age && (
                              <span className="flex items-center gap-1">
                                <Cake className="w-3 h-3 text-cyan-600" />
                                <span>{p.age} yr</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Source Pill */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                        <Tag className="w-3 h-3 text-blue-500" />
                        <span>{b.source || 'Self'}</span>
                      </span>
                    </td>

                    {/* Purpose Pill */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                        <Target className="w-3 h-3 text-rose-500" />
                        <span>{b.purpose || 'Consultation'}</span>
                      </span>
                    </td>

                    {/* Appointment / Reservation Type Pill */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3 h-3 text-slate-600" />
                        <span>{b.reservation_type || 'Appointment'}</span>
                      </span>
                    </td>

                    {/* Visit Info / Status Pill */}
                    <td className="py-3 px-4 text-center">
                      {b.status === 'checked_in' ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#10B981] text-white font-bold text-[11px] shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Checked In</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {b.check_in_time
                              ? `In: ${new Date(b.check_in_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : 'In: 8:28 a.m.'}
                          </span>
                        </div>
                      ) : b.status === 'in_process' ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-cyan-600 text-white font-bold text-[11px] shadow-xs">
                          <Play className="w-3.5 h-3.5" />
                          <span>In Process</span>
                        </span>
                      ) : b.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-800 text-white font-bold text-[11px] shadow-xs">
                          <Check className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </span>
                      ) : b.status === 'absent' ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-600 text-white font-bold text-[11px] shadow-xs">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Patient History */}
                        <button
                          onClick={() => p && onViewHistory(p)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Patient History"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Booking */}
                        <button
                          onClick={() => onEditBooking(b)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Booking"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Print Token: Allowed for Receptionist and Admin only */}
                        {(isReceptionist || isAdmin) && (
                          <button
                            onClick={() => onPrintToken(b)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Print Token Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Check-In / Status toggle: Allowed for Receptionist and Admin only */}
                        {(isReceptionist || isAdmin) && b.status === 'pending' && (
                          <button
                            onClick={() => onUpdateStatus(b.id, 'checked_in')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Mark Checked In"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(isReceptionist || isAdmin) && b.status === 'checked_in' && (
                          <button
                            onClick={() => onUpdateStatus(b.id, 'in_process')}
                            className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                            title="Start Consultation (In Process)"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(isReceptionist || isAdmin) && b.status === 'in_process' && (
                          <button
                            onClick={() => onUpdateStatus(b.id, 'completed')}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Complete Consultation"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Mark Absent */}
                        {(isReceptionist || isAdmin) && b.status === 'pending' && (
                          <button
                            onClick={() => onUpdateStatus(b.id, 'absent')}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Mark Absent"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Soft Delete: Admin Only */}
                        {isAdmin && (
                          <button
                            onClick={() => onDeleteBooking(b.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Booking"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
