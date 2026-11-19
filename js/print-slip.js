// ==============================================================================
// js/print-slip.js — Procedure Token Slip Printer
// Reads session_id and booking_id from URL params, fetches data, renders slip.
// Prices ALWAYS shown (Counselor/Admin only page — RLS enforces access).
// ==============================================================================
import { api } from './api.js';
import { formatTimestamp } from './utils.js';

const $ = id => document.getElementById(id);

async function init() {
  const params    = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const bookingId = params.get('booking_id');
  const isReprint = params.get('reprint') === '1';

  if (!sessionId || !bookingId) {
    document.body.innerHTML = '<p style="padding:24px;color:red;">Missing session_id or booking_id.</p>';
    return;
  }

  // Size toggle
  $('btn-80mm').addEventListener('click', () => $('slip-preview').classList.remove('a5'));
  $('btn-a5').addEventListener('click',   () => $('slip-preview').classList.add('a5'));
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-close').addEventListener('click', () => window.close());
  $('btn-reprint').addEventListener('click', async () => {
    try { await api.reprintCounselingSlip(sessionId); } catch (e) { console.warn('Reprint log error:', e); }
    window.print();
  });

  // Fetch data in parallel
  try {
    const [sessionDetail, clinicInfo] = await Promise.all([
      api.getCounselingSessionDetail(sessionId),
      api.getClinicInfo(),
    ]);

    if (!sessionDetail.success) {
      document.body.innerHTML = `<p style="padding:24px;color:red;">${sessionDetail.error || 'Session not found.'}</p>`;
      return;
    }

    const session    = sessionDetail.session;
    const procedures = sessionDetail.procedures || [];

    // Fetch booking + patient info
    const bookingData = await api.getBookingWithPatient(bookingId);
    const patient     = bookingData?.patient || bookingData || {};
    const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || '—';

    const clinicName = clinicInfo?.name || 'Bariatric Surgery Clinic';

    // ---- Fill slip fields ----
    $('slip-clinic-name').textContent   = clinicName;
    $('slip-footer').textContent        = `Thank you for visiting ${clinicName}`;
    $('slip-token').textContent         = bookingData?.token_number ?? '—';
    $('slip-doctor-name').textContent   = `Dr. ${bookingData?.doctor_name || '—'}`;
    $('slip-patient-name').textContent  = patientName;
    $('slip-mrn').textContent           = patient.patient_mrn || '—';
    $('slip-age-phone').textContent     = `${patient.age ? patient.age + ' yrs' : '—'} / ${patient.full_phone || '—'}`;

    // Date and time (Asia/Karachi)
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'Asia/Karachi',
    });
    const timeStr = now.toLocaleTimeString('en-PK', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Karachi',
    });
    $('slip-date').textContent         = dateStr;
    $('slip-counsel-time').textContent = formatTimestamp(session.completed_at || session.started_at, 'time') || timeStr;
    $('slip-counselor').textContent    = session.counselor_name || '—';

    // ---- Procedures & Prices (ALWAYS shown) ----
    const procRows = $('slip-proc-rows');
    if (procedures.length === 0) {
      procRows.innerHTML = '<div style="font-size:.65rem;color:#888;padding:4px 0;">No procedures recorded.</div>';
      $('slip-total-row').style.display = 'none';
    } else {
      let total = 0;
      procRows.innerHTML = procedures.map(p => {
        const price = parseFloat(p.quoted_price) || 0;
        total += price;
        return `<div class="slip-proc-row">
          <span>${escHtml(p.procedure_name_snapshot)}</span>
          <span>Rs ${price.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
        </div>`;
      }).join('');

      $('slip-total').textContent       = `Rs ${total.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      $('slip-total-row').style.display = '';
    }

    // ---- QR Code ----
    const tokenNum  = bookingData?.token_number ?? '';
    const mrn       = patient.patient_mrn        || '';
    const qrText    = `TOKEN:${tokenNum}|MR:${mrn}|SESSION:${sessionId.slice(0, 8)}|DATE:${dateStr}`;
    renderQR(qrText);

    // Reprint audit
    if (isReprint) {
      try { await api.reprintCounselingSlip(sessionId); } catch (e) { /* silent */ }
    }

    // Auto-print on first open (not reprint)
    if (!isReprint) {
      setTimeout(() => window.print(), 700);
    }

  } catch (err) {
    document.body.innerHTML = `<p style="padding:24px;color:red;">Error: ${err.message}</p>`;
  }
}

// ---------------------------------------------------------------------------
// QR render: uses qrcode-generator if bundled, else compact text fallback
// ---------------------------------------------------------------------------
function renderQR(text) {
  const qrDiv = $('slip-qr');
  // Try to use window.qrcode (if library is added), otherwise use a styled text box
  if (typeof window !== 'undefined' && window.QRCode) {
    try {
      qrDiv.innerHTML = '';
      new window.QRCode(qrDiv, {
        text,
        width: 72,
        height: 72,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      return;
    } catch (e) { /* fall through */ }
  }

  // Fallback: compact visual placeholder
  qrDiv.innerHTML = `
    <svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <!-- Simple decorative QR placeholder -->
      <rect width="72" height="72" fill="white"/>
      <rect x="2" y="2" width="20" height="20" fill="none" stroke="#000" stroke-width="2"/>
      <rect x="6" y="6" width="12" height="12" fill="#000"/>
      <rect x="50" y="2" width="20" height="20" fill="none" stroke="#000" stroke-width="2"/>
      <rect x="54" y="6" width="12" height="12" fill="#000"/>
      <rect x="2" y="50" width="20" height="20" fill="none" stroke="#000" stroke-width="2"/>
      <rect x="6" y="54" width="12" height="12" fill="#000"/>
      <rect x="26" y="6" width="4" height="4" fill="#000"/>
      <rect x="34" y="6" width="4" height="4" fill="#000"/>
      <rect x="42" y="6" width="4" height="4" fill="#000"/>
      <rect x="26" y="14" width="4" height="4" fill="#000"/>
      <rect x="34" y="14" width="4" height="4" fill="#000"/>
      <rect x="26" y="26" width="4" height="4" fill="#000"/>
      <rect x="34" y="26" width="4" height="4" fill="#000"/>
      <rect x="42" y="26" width="4" height="4" fill="#000"/>
      <rect x="50" y="26" width="4" height="4" fill="#000"/>
      <rect x="58" y="26" width="4" height="4" fill="#000"/>
      <rect x="66" y="26" width="4" height="4" fill="#000"/>
      <rect x="26" y="34" width="4" height="4" fill="#000"/>
      <rect x="42" y="34" width="4" height="4" fill="#000"/>
      <rect x="58" y="34" width="4" height="4" fill="#000"/>
      <rect x="26" y="42" width="4" height="4" fill="#000"/>
      <rect x="34" y="42" width="4" height="4" fill="#000"/>
      <rect x="50" y="42" width="4" height="4" fill="#000"/>
      <rect x="34" y="50" width="4" height="4" fill="#000"/>
      <rect x="42" y="50" width="4" height="4" fill="#000"/>
      <rect x="58" y="50" width="4" height="4" fill="#000"/>
      <rect x="34" y="58" width="4" height="4" fill="#000"/>
      <rect x="50" y="58" width="4" height="4" fill="#000"/>
      <rect x="66" y="58" width="4" height="4" fill="#000"/>
      <rect x="34" y="66" width="4" height="4" fill="#000"/>
      <rect x="50" y="66" width="4" height="4" fill="#000"/>
    </svg>
    <div style="font-size:.5rem;color:#888;margin-top:1px;word-break:break-all;max-width:72px;">
      ${escHtml(text.slice(0, 48))}
    </div>`;
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

init().catch(err => {
  document.body.innerHTML = `<p style="padding:24px;color:red;">Failed to load slip: ${err.message}</p>`;
});
