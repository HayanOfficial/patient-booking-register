import React, { useState, useEffect } from 'react';
import { X, Printer, Check, Copy, Flame, FileText, CheckCircle2 } from 'lucide-react';
import { Booking, ClinicSettings } from '../types';
import { printHtmlContent } from '../utils/printHelper';

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
  const [printFormat, setPrintFormat] = useState<'80mm' | '58mm' | 'a5'>('80mm');
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName))) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, booking, printFormat]);

  if (!isOpen || !booking) return null;

  const p = booking.patient;
  const clinicName = clinicInfo?.name || 'Dr Zarin Medical Center';
  const clinicTagline = clinicInfo?.tagline || 'Real-time schedule and patient coordination center';
  const clinicPhone = clinicInfo?.phone || '+92-91-5840000';
  const clinicAddress = clinicInfo?.address || 'Khyber Medical Centre, Peshawar';
  const printTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const patientFullName = p ? `${p.first_name} ${p.last_name || ''}`.trim() : 'Patient';

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintSuccess(false);

    try {
      const isThermal = printFormat === '80mm' || printFormat === '58mm';
      const fontSizeBase = printFormat === '58mm' ? '11px' : '13px';
      const tokenFontSize = printFormat === '58mm' ? '28px' : '38px';

      const thermalHtml = `
        <div style="font-family: 'Courier New', Courier, monospace; color: #000; text-align: center; font-size: ${fontSizeBase}; line-height: 1.35; padding: 2px;">
          <div style="font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${clinicName}</div>
          <div style="font-size: 10px; margin-top: 2px;">${clinicTagline}</div>
          <div style="font-size: 10px; font-weight: bold; margin-top: 1px;">Ph: ${clinicPhone}</div>
          <div style="font-size: 9px; margin-top: 1px;">${clinicAddress}</div>
          
          <div style="border-top: 1.5px dashed #000; margin: 6px 0;"></div>
          
          <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">TOKEN NUMBER</div>
          <div style="font-size: ${tokenFontSize}; font-weight: 900; margin: 4px 0; padding: 4px 0; border: 2px solid #000; background: #fff; letter-spacing: 1px;">
            ${booking.token_code}
          </div>
          
          <div style="font-size: 13px; font-weight: 900; margin-top: 3px;">
            Slot #${booking.slot_index} &bull; ${booking.slot_time_formatted}
          </div>
          <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">
            Date: ${booking.booking_date}
          </div>

          <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

          <div style="text-align: left; font-size: 11px; line-height: 1.4;">
            <div><strong>Doctor:</strong> ${booking.doctor_name || 'Dr Zarin'}</div>
            <div><strong>Shift:</strong> ${booking.shift_name || 'Default Shift'}</div>
            <div><strong>Patient:</strong> ${patientFullName}</div>
            ${p?.patient_mrn ? `<div><strong>MRN:</strong> ${p.patient_mrn}</div>` : ''}
            ${p?.full_phone ? `<div><strong>Phone:</strong> ${p.full_phone}</div>` : ''}
            ${p?.cnic ? `<div><strong>CNIC:</strong> ${p.cnic}</div>` : ''}
            ${p?.city || p?.area ? `<div><strong>City/Area:</strong> ${[p?.area, p?.city].filter(Boolean).join(', ')}</div>` : ''}
            <div><strong>Purpose:</strong> ${booking.purpose} (${booking.reservation_type})</div>
            ${booking.remarks ? `<div><strong>Notes:</strong> ${booking.remarks}</div>` : ''}
          </div>

          <div style="border-top: 1.5px dashed #000; margin: 6px 0;"></div>
          
          <div style="font-size: 10px; font-weight: bold;">
            Please take a seat and wait for your token number to be announced.
          </div>
          <div style="font-size: 9px; margin-top: 4px; color: #333;">
            Printed at: ${printTimeStr}
          </div>
        </div>
      `;

      const a5Html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #000; font-size: 13px; line-height: 1.5; padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px;">
            <div>
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">${clinicName}</h2>
              <p style="margin: 2px 0 0; font-size: 11px; color: #444;">${clinicTagline}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: #444;">${clinicAddress} &bull; Ph: ${clinicPhone}</p>
            </div>
            <div style="text-align: right;">
              <div style="background: #000; color: #fff; font-size: 24px; font-weight: 900; padding: 4px 14px; border-radius: 6px; display: inline-block;">
                ${booking.token_code}
              </div>
              <div style="font-size: 12px; font-weight: bold; margin-top: 3px;">Slot #${booking.slot_index}</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; font-size: 12px;">
            <div><strong style="color: #555; display: block;">Appointment Date:</strong> <b>${booking.booking_date}</b></div>
            <div><strong style="color: #555; display: block;">Slot Time:</strong> <b>${booking.slot_time_formatted}</b></div>
            <div><strong style="color: #555; display: block;">Doctor:</strong> <b>${booking.doctor_name || 'Dr Zarin'}</b></div>
            <div><strong style="color: #555; display: block;">Shift:</strong> <b>${booking.shift_name || 'Standard Shift'}</b></div>
            <div><strong style="color: #555; display: block;">Patient Name:</strong> <b>${patientFullName}</b></div>
            <div><strong style="color: #555; display: block;">MRN / File #:</strong> <b>${p?.patient_mrn || 'N/A'}</b></div>
            <div><strong style="color: #555; display: block;">Phone Number:</strong> <b>${p?.full_phone || 'N/A'}</b></div>
            <div><strong style="color: #555; display: block;">CNIC:</strong> <b>${p?.cnic || 'N/A'}</b></div>
            <div><strong style="color: #555; display: block;">City & Area:</strong> <b>${[p?.area, p?.city].filter(Boolean).join(', ') || 'Peshawar'}</b></div>
            <div><strong style="color: #555; display: block;">Reservation Type:</strong> <b>${booking.reservation_type} (${booking.purpose})</b></div>
          </div>

          ${booking.remarks ? `<div style="background: #f8f9fa; padding: 8px; border-radius: 4px; font-size: 11px; margin-bottom: 10px;"><strong>Remarks:</strong> ${booking.remarks}</div>` : ''}

          <div style="border-top: 1px solid #ddd; padding-top: 8px; font-size: 11px; text-align: center; color: #555;">
            Please present this token at the reception/nursing station when your number is called.
            <div style="font-size: 10px; margin-top: 3px; color: #888;">Printed: ${new Date().toLocaleString()}</div>
          </div>
        </div>
      `;

      await printHtmlContent(isThermal ? thermalHtml : a5Html, {
        format: printFormat,
        title: `Token-${booking.token_code}-${booking.booking_date}`,
      });

      setPrintSuccess(true);
      setTimeout(() => setPrintSuccess(false), 2500);
    } catch (err) {
      console.error('Printing failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyText = () => {
    const text = `
=== ${clinicName} ===
TOKEN: ${booking.token_code}
Slot #${booking.slot_index} — ${booking.slot_time_formatted}
Date: ${booking.booking_date}
Doctor: ${booking.doctor_name || 'Dr Zarin'}
Shift: ${booking.shift_name || 'Default Shift'}
Patient: ${patientFullName}
MRN: ${p?.patient_mrn || 'N/A'}
Phone: ${p?.full_phone || 'N/A'}
Purpose: ${booking.purpose} (${booking.reservation_type})
Printed: ${new Date().toLocaleTimeString()}
===============================
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Print Patient Token Slip</h3>
              <p className="text-[11px] text-slate-400">Thermal POS 80mm/58mm & Standard A5 slip</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Printer Format:</span>
            <div className="inline-flex bg-white rounded-lg p-0.5 border border-slate-300 shadow-xs">
              <button
                onClick={() => setPrintFormat('80mm')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1 ${
                  printFormat === '80mm'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>80mm Thermal</span>
              </button>
              <button
                onClick={() => setPrintFormat('58mm')}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1 ${
                  printFormat === '58mm'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>58mm Mini</span>
              </button>
              <button
                onClick={() => setPrintFormat('a5')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1 ${
                  printFormat === 'a5'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A5 Standard</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleCopyText}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-200 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>
        </div>

        {/* Slip Preview Area */}
        <div className="p-6 bg-slate-200/70 flex justify-center max-h-[58vh] overflow-y-auto">
          {printFormat === '80mm' || printFormat === '58mm' ? (
            /* 80mm / 58mm Thermal Slip Preview */
            <div
              id="printable-slip"
              className={`${
                printFormat === '58mm' ? 'w-60 text-[11px]' : 'w-72 text-xs'
              } bg-white p-5 rounded-md shadow-lg border border-slate-300 font-mono text-slate-900 text-center leading-snug select-text thermal-monochrome`}
            >
              <div className="text-sm font-black uppercase tracking-tight text-slate-950">{clinicName}</div>
              <div className="text-[10px] text-slate-600 mt-0.5 font-sans">{clinicTagline}</div>
              <div className="text-[10px] font-bold text-slate-700 font-mono mt-0.5">{clinicPhone}</div>
              <div className="text-[9px] text-slate-500 font-sans">{clinicAddress}</div>
              
              <div className="border-b-2 border-dashed border-slate-400 my-2.5" />

              {/* Big Token */}
              <div className="text-[10px] font-black text-slate-600 uppercase tracking-wider">TOKEN NUMBER</div>
              <div className="text-4xl font-black text-slate-950 tracking-wider my-1.5 bg-amber-50/80 py-1.5 rounded-lg border-2 border-slate-900">
                {booking.token_code}
              </div>
              <div className="text-xs font-black text-slate-900">Slot #{booking.slot_index} &bull; {booking.slot_time_formatted}</div>
              <div className="text-[11px] font-bold text-slate-600 mt-0.5">{booking.booking_date}</div>

              <div className="border-b border-dashed border-slate-400 my-2.5" />

              {/* Doctor and Shift */}
              <div className="text-left text-xs space-y-1 font-mono">
                <div>
                  <span className="text-slate-600 font-medium">Doctor:</span>{' '}
                  <span className="font-black text-slate-950">{booking.doctor_name || 'Dr Zarin'}</span>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">Shift:</span>{' '}
                  <span className="font-bold text-slate-900">{booking.shift_name || 'Default Shift'}</span>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">Patient:</span>{' '}
                  <span className="font-black text-slate-950">{patientFullName}</span>
                </div>
                {p?.patient_mrn && (
                  <div>
                    <span className="text-slate-600 font-medium">MRN:</span>{' '}
                    <span className="font-bold text-slate-900">{p.patient_mrn}</span>
                  </div>
                )}
                {p?.full_phone && (
                  <div>
                    <span className="text-slate-600 font-medium">Phone:</span>{' '}
                    <span className="font-bold text-slate-900">{p.full_phone}</span>
                  </div>
                )}
                {p?.cnic && (
                  <div>
                    <span className="text-slate-600 font-medium">CNIC:</span>{' '}
                    <span className="font-semibold text-slate-900">{p.cnic}</span>
                  </div>
                )}
                {(p?.city || p?.area) && (
                  <div>
                    <span className="text-slate-600 font-medium">Location:</span>{' '}
                    <span className="font-semibold text-slate-900">{[p?.area, p?.city].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-600 font-medium">Purpose:</span>{' '}
                  <span className="font-bold text-slate-950">{booking.purpose} ({booking.reservation_type})</span>
                </div>
                {booking.remarks && (
                  <div>
                    <span className="text-slate-600 font-medium">Notes:</span>{' '}
                    <span className="text-slate-800">{booking.remarks}</span>
                  </div>
                )}
              </div>

              <div className="border-b-2 border-dashed border-slate-400 my-2.5" />
              <div className="text-[10px] font-bold text-slate-700">
                Please wait for your token number to be called.
              </div>
              <div className="text-[9px] text-slate-500 mt-1 font-mono">
                Printed: {printTimeStr}
              </div>
            </div>
          ) : (
            /* A5 Standard Slip Preview */
            <div
              id="printable-slip"
              className="w-96 bg-white p-6 rounded-xl shadow-lg border border-slate-300 font-sans text-slate-900 text-left select-text"
            >
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                <div>
                  <h4 className="font-black text-base text-slate-950 uppercase">{clinicName}</h4>
                  <p className="text-xs text-slate-600">{clinicTagline}</p>
                  <p className="text-xs text-slate-600">{clinicAddress}</p>
                  <p className="text-xs font-bold text-slate-700 font-mono mt-0.5">Ph: {clinicPhone}</p>
                </div>
                <div className="text-right">
                  <div className="bg-amber-500 text-slate-950 font-black text-2xl px-3 py-1 rounded-lg border border-amber-600 shadow-xs">
                    {booking.token_code}
                  </div>
                  <div className="text-[11px] font-black text-slate-800 mt-1">Slot #{booking.slot_index}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 my-4 text-xs">
                <div>
                  <span className="text-slate-500 block font-medium">Date & Time:</span>
                  <span className="font-bold text-slate-950">{booking.booking_date} at {booking.slot_time_formatted}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Doctor:</span>
                  <span className="font-bold text-slate-950">{booking.doctor_name || 'Dr Zarin'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Patient Name:</span>
                  <span className="font-bold text-slate-950">{patientFullName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">MRN:</span>
                  <span className="font-bold font-mono text-slate-950">{p?.patient_mrn || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Contact Phone:</span>
                  <span className="font-bold font-mono text-slate-950">{p?.full_phone || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">CNIC:</span>
                  <span className="font-bold font-mono text-slate-950">{p?.cnic || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Purpose:</span>
                  <span className="font-bold text-slate-950">{booking.purpose}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Reservation:</span>
                  <span className="font-bold text-slate-950">{booking.reservation_type}</span>
                </div>
              </div>

              {booking.remarks && (
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs text-slate-700 mb-3">
                  <span className="font-bold text-slate-900">Notes: </span>
                  {booking.remarks}
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 text-center text-xs text-slate-600">
                Please present this token at the reception desk when requested.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">Enter</kbd> to print immediately
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs shadow-md flex items-center gap-2 transition disabled:opacity-50"
            >
              {printSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                  <span>Printed!</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>{isPrinting ? 'Sending...' : 'Print Token'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
