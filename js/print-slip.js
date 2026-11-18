// ==============================================================================
// js/print-slip.js — Procedure Slip Printer
// Reads session_id and booking_id from URL params, fetches data, renders slip.
// ==============================================================================
import { api } from './api.js';
import { getSession } from './auth.js';
import { formatTimestamp } from './utils.js';

const $ = id => document.getElementById(id);

async function init() {
  const params  = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const bookingId = params.get('booking_id');
  const isReprint = params.get('reprint') === '1';

  if (!sessionId || !bookingId) {
    document.body.innerHTML = '<p style="padding:24px;color:red;">Missing session_id or booking_id.</p>';
    return;
  }

  // Size toggle
  $('btn-80mm').addEventListener('click', () => {
    $('slip-preview').classList.remove('a5');
  });
  $('btn-a5').addEventListener('click', () => {
    $('slip-preview').classList.add('a5');
  });
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-close').addEventListener('click', () => window.close());
  $('btn-reprint').addEventListener('click', async () => {
    try {
      await api.reprintCounselingSlip(sessionId);
    } catch (e) { console.warn('Reprint log error:', e); }
    window.print();
  });

  // Fetch data
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

    // Check show_prices setting
    const showPrices = session.show_prices_on_slip !== false;

    // Fill slip
    $('slip-clinic-name').textContent = clinicInfo?.name || 'Bariatric Surgery Clinic';
    $('slip-footer').textContent      = `Thank you for visiting ${clinicInfo?.name || 'Bariatric Surgery Clinic'}`;

    if (bookingData) {
      const patient = bookingData.patient || bookingData;
      const name    = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || '—';
      $('slip-token').textContent        = bookingData.token_number ?? '—';
      $('slip-doctor-name').textContent  = bookingData.doctor_name || '—';
      $('slip-patient-name').textContent = name;
      $('slip-mrn').textContent          = patient.patient_mrn || '—';
      $('slip-age-phone').textContent    = `${patient.age ? patient.age + 'y' : '—'} / ${patient.full_phone || '—'}`;
    }

    $('slip-date').textContent         = new Date(session.created_at).toLocaleDateString('en-PK');
    $('slip-counsel-time').textContent = formatTimestamp(session.completed_at || session.started_at, 'time');
    $('slip-counselor').textContent    = session.counselor_name || '—';

    // Hide price column if not showing
    if (!showPrices) {
      $('slip-price-col-header').style.display = 'none';
    }

    // Procedures
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
          ${showPrices ? `<span>Rs ${price.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>` : ''}
        </div>`;
      }).join('');

      if (showPrices) {
        $('slip-total').textContent = `Rs ${total.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        $('slip-total-row').style.display = '';
      } else {
        $('slip-total-row').style.display = 'none';
      }
    }

    // QR (simple text QR using Data URI approach via qrcode-generator if available, else text)
    const qrText = `TOKEN:${bookingData?.token_number || ''}|MR:${bookingData?.patient?.patient_mrn || ''}|SESSION:${sessionId.slice(0,8)}`;
    renderQR(qrText);

    // Reprint audit
    if (isReprint) {
      try { await api.reprintCounselingSlip(sessionId); } catch (e) { /* silent */ }
    }

    // Auto print on first open (not reprint)
    if (!isReprint) {
      setTimeout(() => window.print(), 600);
    }

  } catch (err) {
    document.body.innerHTML = `<p style="padding:24px;color:red;">Error: ${err.message}</p>`;
  }
}

function renderQR(text) {
  const qrDiv = $('slip-qr');
  // Simple visual fallback — in production, include a QR library
  qrDiv.innerHTML = `<div style="font-size:.55rem;color:#888;border:1px dashed #ccc;display:inline-block;padding:4px 8px;">
    QR: ${escHtml(text.slice(0, 40))}
  </div>`;
  // If qrcode library is bundled, replace above with actual QR canvas
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

init().catch(err => {
  document.body.innerHTML = `<p style="padding:24px;color:red;">Failed to load slip: ${err.message}</p>`;
});
