'use client';

import React, { useState } from 'react';
import { X, Printer, Check, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Booking, ClinicSettings } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface TokenPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  clinicInfo: ClinicSettings | null;
}

export const TokenPrintModal: React.FC<TokenPrintModalProps> = ({
  isOpen,
  onClose,
  booking,
  clinicInfo,
}) => {
  const { user } = useAuth();
  const [format, setFormat] = useState<'80mm' | 'a5'>('80mm');
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !booking) return null;

  const p = booking.patient;
  const clinicName = clinicInfo?.name || 'Dr Naeem Eye Laser & Retina Center';
  const clinicTagline = clinicInfo?.tagline || 'Real-time schedule and patient coordination center';
  const clinicPhone = clinicInfo?.phone || '+92-91-5840000';
  const clinicAddress = clinicInfo?.address || 'Khyber Medical Centre, Peshawar';
  const patientFullName = p ? `${p.first_name} ${p.last_name || ''}`.trim() : 'Patient';

  const qrPayload = JSON.stringify({
    token: booking.token_code,
    date: booking.booking_date,
    mrn: p?.patient_mrn,
    doctor: booking.doctor_name,
    slot: booking.slot_time_formatted,
  });

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      // Record reprint audit if printed before
      if (user) {
        await api.reprintToken(booking.id, user.id, user.username, format);
      }
      window.print();
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyText = () => {
    const text = `
--------------------------------
${clinicName}
${clinicTagline}
Ph: ${clinicPhone}
--------------------------------
TOKEN NUMBER: ${booking.token_code}
Slot #${booking.slot_index} • ${booking.slot_time_formatted}
Date: ${booking.booking_date}
Doctor: ${booking.doctor_name}
Patient: ${patientFullName} (${p?.patient_mrn || ''})
Phone: ${p?.full_phone || ''}
Purpose: ${booking.purpose} (${booking.reservation_type})
--------------------------------
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold">Print Token Slip</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Select Print Format:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFormat('80mm')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                format === '80mm'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-300'
              }`}
            >
              80mm Thermal
            </button>
            <button
              onClick={() => setFormat('a5')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                format === 'a5'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-300'
              }`}
            >
              A5 Standard
            </button>
          </div>
        </div>

        {/* Printable Slip Preview */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex justify-center">
          <div
            id="printable-slip"
            className={`bg-white border border-slate-300 shadow-md p-5 text-slate-900 ${
              format === '80mm' ? 'w-[320px] font-mono' : 'w-full max-w-md font-sans'
            }`}
          >
            {/* Header */}
            <div className="text-center pb-3 border-b-2 border-dashed border-slate-400">
              <div className="text-sm font-black uppercase tracking-tight">{clinicName}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{clinicTagline}</div>
              <div className="text-[10px] font-bold text-slate-600 mt-0.5">Ph: {clinicPhone}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">{clinicAddress}</div>
            </div>

            {/* Token Code Box */}
            <div className="text-center my-4">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                TOKEN NUMBER
              </div>
              <div className="text-4xl font-black tracking-widest border-2 border-slate-900 bg-amber-50/50 py-2 my-1 text-slate-950 rounded-lg">
                {booking.token_code}
              </div>
              <div className="text-xs font-extrabold text-slate-800">
                Slot #{booking.slot_index} &bull; {booking.slot_time_formatted}
              </div>
              <div className="text-[11px] font-bold text-slate-600 mt-0.5">
                Date: {booking.booking_date}
              </div>
            </div>

            {/* Patient & Booking Details */}
            <div className="border-t-2 border-b-2 border-dashed border-slate-400 py-3 text-[11px] space-y-1">
              <div>
                <strong>Doctor:</strong> {booking.doctor_name || 'Dr Naeem Khattak'}
              </div>
              <div>
                <strong>Shift:</strong> {booking.shift_name || 'Default Shift'}
              </div>
              <div>
                <strong>Patient:</strong> {patientFullName}
              </div>
              {p?.patient_mrn && (
                <div>
                  <strong>MRN:</strong> {p.patient_mrn}
                </div>
              )}
              {p?.full_phone && (
                <div>
                  <strong>Phone:</strong> {p.full_phone}
                </div>
              )}
              {p?.cnic && (
                <div>
                  <strong>CNIC:</strong> {p.cnic}
                </div>
              )}
              {(p?.area || p?.city) && (
                <div>
                  <strong>Area/City:</strong> {[p?.area, p?.city].filter(Boolean).join(', ')}
                </div>
              )}
              <div>
                <strong>Purpose:</strong> {booking.purpose} ({booking.reservation_type})
              </div>
              {booking.remarks && (
                <div>
                  <strong>Notes:</strong> {booking.remarks}
                </div>
              )}
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center pt-3">
              <QRCodeSVG value={qrPayload} size={84} level="M" />
              <div className="text-[9px] text-slate-400 mt-2 text-center">
                Scan to verify token &bull; Please wait for announcement
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleCopyText}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Slip Text'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Printing...' : 'Print Token Slip'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
