import React, { useState } from 'react';
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
  UserX,
  Trash2,
  PhoneCall,
  PlusCircle,
  Check,
  Zap,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { SlotItem, Booking, BookingStatus } from '../types';

// ─── Confirmation Dialog ───────────────────────────────────────────────────────
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmColor?: string;
}
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  confirmColor = 'bg-emerald-500 hover:bg-emerald-600',
}) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800 leading-snug pt-1">{message}</p>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 py-2 rounded-xl text-white font-bold text-xs transition ${confirmColor}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

interface BookingTableProps {
  slots: SlotItem[];
  onQuickBookSlot: (slot: SlotItem) => void;
  onEditBooking: (booking: Booking) => void;
  onPrintToken: (booking: Booking) => void;
  onStatusChange: (bookingId: string, status: BookingStatus) => void;
  onDeleteBooking: (bookingId: string) => void;
  onCallPatient?: (phone: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canCheckIn: boolean;
}

export const BookingTable: React.FC<BookingTableProps> = ({
  slots,
  onQuickBookSlot,
  onEditBooking,
  onPrintToken,
  onStatusChange,
  onDeleteBooking,
  onCallPatient,
  canEdit,
  canDelete,
  canCheckIn,
}) => {
  // Confirmation dialog state
  type PendingAction = { bookingId: string; status: BookingStatus; message: string; confirmLabel: string; confirmColor: string };
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const requestStatusChange = (bookingId: string, status: BookingStatus, message: string, confirmLabel: string, confirmColor = 'bg-emerald-500 hover:bg-emerald-600') => {
    setPendingAction({ bookingId, status, message, confirmLabel, confirmColor });
  };

  const executeConfirmed = () => {
    if (pendingAction) {
      onStatusChange(pendingAction.bookingId, pendingAction.status);
      setPendingAction(null);
    }
  };

  return (
    <>
      {/* Confirmation Dialog Portal */}
      {pendingAction && (
        <ConfirmDialog
          message={pendingAction.message}
          confirmLabel={pendingAction.confirmLabel}
          confirmColor={pendingAction.confirmColor}
          onConfirm={executeConfirmed}
          onCancel={() => setPendingAction(null)}
        />
      )}

      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden mx-6 my-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-14 text-center">SR#</th>
              <th className="py-3 px-4 w-32 text-left">TIME</th>
              <th className="py-3 px-4 min-w-[320px]">PATIENT IDENTIFICATION</th>
              <th className="py-3 px-3 w-28 text-center">SOURCE</th>
              <th className="py-3 px-3 w-36 text-center">PURPOSE</th>
              <th className="py-3 px-3 w-36 text-center">APPOINTMENT</th>
              <th className="py-3 px-4 w-36 text-center">VISIT INFO</th>
              <th className="py-3 px-4 w-44 text-center">ACTIONS</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 text-xs">
            {slots.map((slot) => {
              const booking = slot.booking;

              // 1. EMPTY SLOT ROW
              if (!slot.is_booked || !booking) {
                return (
                  <tr
                    key={`slot-${slot.slot_index}`}
                    className="hover:bg-amber-50/40 transition-colors group"
                  >
                    {/* SR# */}
                    <td className="py-3 px-4 text-center font-mono font-medium text-slate-400">
                      {slot.slot_index}
                    </td>

                    {/* TIME */}
                    <td className="py-3 px-4">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs shadow-xs">
                        {slot.slot_time_formatted}
                      </div>
                    </td>

                    {/* QUICK BOOK BUTTON (Spanning remaining columns) */}
                    <td colSpan={6} className="py-3 px-4">
                      <button
                        onClick={() => onQuickBookSlot(slot)}
                        className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 py-1.5 px-4 rounded-full border border-amber-400/90 bg-amber-50/60 hover:bg-amber-400 hover:text-slate-950 text-amber-800 font-bold text-xs shadow-xs transition-all active:scale-98 group-hover:border-amber-500"
                      >
                        <PlusCircle className="w-4 h-4 text-amber-600 group-hover:text-slate-950" />
                        <span>Quick Book Slot</span>
                      </button>
                    </td>
                  </tr>
                );
              }

              // 2. BOOKED ROW
              const p = booking.patient;
              const isCheckedIn = booking.status === 'checked_in';
              const isPending = booking.status === 'pending';
              const isInProcess = booking.status === 'in_process';
              const isCompleted = booking.status === 'completed';
              const isAbsent = booking.status === 'absent';
              const isFollowUp = booking.status === 'follow_up';

              return (
                <tr
                  key={`booking-${booking.id}`}
                  className="hover:bg-slate-50/90 transition-colors group"
                >
                  {/* SR# */}
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                    {slot.slot_index}
                  </td>

                  {/* TIME BADGE */}
                  <td className="py-3.5 px-4">
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-950 font-extrabold text-xs shadow-xs">
                      {slot.slot_time_formatted}
                    </div>
                  </td>

                  {/* PATIENT IDENTIFICATION */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar Circle */}
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>

                      <div className="flex flex-col gap-1 min-w-0">
                        {/* Name + Called As Pill + Token Pill */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {p ? `${p.first_name} ${p.last_name || ''}`.trim() : 'Patient'}
                          </span>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0284C7] text-white shadow-xs">
                            {booking.called_as || 'Hospital Patient'}
                          </span>

                          {booking.token_code && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-slate-800 text-amber-400">
                              {booking.token_code}
                            </span>
                          )}
                        </div>

                        {/* Line 2: Phone, Location, Age */}
                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          {p?.full_phone && (
                            <div className="flex items-center gap-1 font-mono text-emerald-800 font-semibold">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>{p.full_phone}</span>
                            </div>
                          )}

                          {(p?.city || p?.area || p?.address) && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                              <span className="truncate max-w-[180px]">
                                {p.area || p.address || p.city}
                              </span>
                            </div>
                          )}

                          {(p?.age || p?.dob) && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Cake className="w-3 h-3 text-sky-500 shrink-0" />
                              <span>
                                {p.age ? `${p.age} yr` : ''}
                                {p.dob ? ` (${p.dob})` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* SOURCE */}
                  <td className="py-3.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                      <Tag className="w-3 h-3 text-blue-500" />
                      <span>{booking.source || 'Self'}</span>
                    </div>
                  </td>

                  {/* PURPOSE */}
                  <td className="py-3.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-[11px]">
                      <Target className="w-3 h-3 text-rose-500" />
                      <span>{booking.purpose || 'Consultation'}</span>
                    </div>
                  </td>

                  {/* APPOINTMENT / RESERVATION TYPE */}
                  <td className="py-3.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3 h-3 text-slate-700" />
                      <span>{booking.reservation_type || 'Appointment'}</span>
                    </div>
                  </td>

                  {/* VISIT INFO / STATUS PILL */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      {isCheckedIn ? (
                        <div className="inline-flex flex-col items-center gap-1">
                          <button
                            onClick={() => canCheckIn && requestStatusChange(
                              booking.id, 'in_process',
                              'Move this patient to "In Process"?',
                              'Yes, In Process',
                              'bg-sky-500 hover:bg-sky-600'
                            )}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#10B981] hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Checked In</span>
                          </button>
                          {booking.check_in_time && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              In: {booking.check_in_time}
                            </span>
                          )}
                          {/* Revert to Pending button */}
                          {canCheckIn && (
                            <button
                              onClick={() => requestStatusChange(
                                booking.id, 'pending',
                                'Revert this patient back to "Pending" status? This will undo the check-in.',
                                'Yes, Revert',
                                'bg-amber-500 hover:bg-amber-600'
                              )}
                              title="Revert to Pending"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-semibold text-[10px] hover:bg-amber-100 transition"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Revert</span>
                            </button>
                          )}
                        </div>
                      ) : isInProcess ? (
                        <button
                          onClick={() => canCheckIn && requestStatusChange(
                            booking.id, 'completed',
                            'Mark this visit as "Completed"?',
                            'Mark Completed',
                            'bg-teal-600 hover:bg-teal-700'
                          )}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs transition"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>In Process</span>
                        </button>
                      ) : isCompleted ? (
                        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-teal-600 text-white font-bold text-xs shadow-xs">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </div>
                      ) : isAbsent ? (
                        <div className="inline-flex flex-col items-center gap-1">
                          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500 text-white font-bold text-xs shadow-xs">
                            <UserX className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </div>
                          {canCheckIn && (
                            <button
                              onClick={() => requestStatusChange(
                                booking.id, 'pending',
                                'Revert from "Absent" back to "Pending"?',
                                'Yes, Revert',
                                'bg-amber-500 hover:bg-amber-600'
                              )}
                              title="Revert to Pending"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-semibold text-[10px] hover:bg-amber-100 transition"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Revert</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        /* PENDING — clicking requires confirmation */
                        <button
                          onClick={() => canCheckIn && requestStatusChange(
                            booking.id, 'checked_in',
                            `Check in "${p ? `${p.first_name} ${p.last_name || ''}`.trim() : 'this patient'}"?`,
                            'Yes, Check In',
                            'bg-emerald-500 hover:bg-emerald-600'
                          )}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 border border-slate-300 font-bold text-xs shadow-xs transition"
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Pending</span>
                        </button>
                      )}
                    </div>
                  </td>

                  {/* ACTION ICONS */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-500">
                      {/* Call Patient */}
                      <button
                        onClick={() => onCallPatient && p?.full_phone && onCallPatient(p.full_phone)}
                        title={`Call ${p?.first_name || 'patient'}`}
                        className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </button>

                      {/* Edit Booking */}
                      {canEdit && (
                        <button
                          onClick={() => onEditBooking(booking)}
                          title="Edit Booking"
                          className="p-1.5 hover:text-amber-600 hover:bg-amber-50 rounded-full transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Print Token Slip */}
                      <button
                        onClick={() => onPrintToken(booking)}
                        title="Print Token Slip (Thermal 80mm / A5)"
                        className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {/* Mark Absent — requires confirmation */}
                      {canCheckIn && !isAbsent && (
                        <button
                          onClick={() => requestStatusChange(
                            booking.id, 'absent',
                            `Mark "${p ? `${p.first_name} ${p.last_name || ''}`.trim() : 'this patient'}" as Absent?`,
                            'Mark Absent',
                            'bg-rose-500 hover:bg-rose-600'
                          )}
                          title="Mark Patient Absent"
                          className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-full transition"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete / Cancel Booking */}
                      {canDelete && (
                        <button
                          onClick={() => onDeleteBooking(booking.id)}
                          title="Delete / Cancel Booking"
                          className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-full transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
};
