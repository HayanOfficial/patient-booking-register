// ==============================================================================
// Comprehensive Verification Test Suite
// Verifies:
// 1. Zero occurrences of forbidden doctor/center names in source files
// 2. Only Admin can add/delete doctors and shifts
// 3. 20 parallel check-ins give unique consecutive numbers 1..20
// 4. Token order matches check-in order, not booking order
// 5. Appointment and walk-in share one sequence
// 6. Double check-in returns the same token; no token exists before check-in
// 7. Receptionist can check in, operator cannot
// ==============================================================================

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('🧪 Starting Patient Booking Register Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error('     ' + (err.stack || err.message));
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error('     ' + (err.stack || err.message));
  }
}

// ------------------------------------------------------------------------------
// TEST 1: No forbidden names anywhere in the source files
// ------------------------------------------------------------------------------
runTest('No old doctor or center names in source code', () => {
  const rootDir = process.cwd();
  // Target forbidden patterns without writing literals directly in source scanner
  const patternA = String.fromCharCode(110, 97, 101, 101, 109);
  const patternB = String.fromCharCode(107, 104, 97, 116, 116, 97, 107);
  const forbiddenRegex = new RegExp(`${patternA}|${patternB}`, 'i');
  const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'reference']);
  const violations = [];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ignoredDirs.has(ent.name)) continue;
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanDir(fullPath);
      } else if (ent.isFile()) {
        if (ent.name === 'system.test.js') continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        if (forbiddenRegex.test(content)) {
          violations.push(path.relative(rootDir, fullPath));
        }
      }
    }
  }

  scanDir(rootDir);
  assert.strictEqual(
    violations.length,
    0,
    `Found forbidden names in files: ${violations.join(', ')}`
  );
});

// Mock environment for API tests
globalThis.sessionStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};
globalThis.localStorage = globalThis.sessionStorage;
globalThis.window = {
  location: { href: '' }
};

// Import API layer
const { api } = await import('../js/api.js');
const { saveSession } = await import('../js/auth.js');

const adminUser = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'admin',
  full_name: 'System Administrator',
  role: 'admin',
  status: 'active'
};

const receptionistUser = {
  id: '33333333-3333-3333-3333-333333333333',
  username: 'receptionist',
  full_name: 'Front Desk Sara',
  role: 'receptionist',
  status: 'active'
};

const operatorUser = {
  id: '22222222-2222-2222-2222-222222222222',
  username: 'operator',
  full_name: 'Lead Operator Ali',
  role: 'operator',
  status: 'active'
};

// ------------------------------------------------------------------------------
// TEST 2: Only Admin can add/delete doctors and shifts (RLS / Auth check)
// ------------------------------------------------------------------------------
await runAsyncTest('Only Admin can add/delete doctors and shifts (Operator rejected)', async () => {
  saveSession(operatorUser);

  // Operator cannot save doctor
  let docFailed = false;
  try {
    await api.saveDoctor({ name: 'Dr Unauthorized', specialty: 'General' });
  } catch (err) {
    docFailed = true;
    assert.match(err.message, /Admin role required/i);
  }
  assert.strictEqual(docFailed, true, 'Operator should not be allowed to save doctor');

  // Operator cannot delete doctor
  let docDelFailed = false;
  try {
    await api.deleteDoctor('doc-test-id');
  } catch (err) {
    docDelFailed = true;
    assert.match(err.message, /Admin role required/i);
  }
  assert.strictEqual(docDelFailed, true, 'Operator should not be allowed to delete doctor');

  // Operator cannot save shift
  let shiftFailed = false;
  try {
    await api.saveShift({ name: 'Shift Unauthorized', doctor_id: 'doc-1' });
  } catch (err) {
    shiftFailed = true;
    assert.match(err.message, /Admin role required/i);
  }
  assert.strictEqual(shiftFailed, true, 'Operator should not be allowed to save shift');

  // Admin CAN save doctor and shift
  saveSession(adminUser);
  const newDoc = await api.saveDoctor({ name: 'Dr Test Doctor', specialty: 'Bariatric' });
  assert.ok(newDoc.id, 'Admin should be able to create doctor');

  const newShift = await api.saveShift({ name: 'Evening Shift Test', doctor_id: newDoc.id });
  assert.ok(newShift.id, 'Admin should be able to create shift');

  await api.deleteDoctor(newDoc.id);
  await api.deleteShift(newShift.id);
});

// ------------------------------------------------------------------------------
// TEST 3: Double check-in returns the same token & No token exists before check-in
// ------------------------------------------------------------------------------
await runAsyncTest('No token exists before check-in, and double check-in returns existing token', async () => {
  saveSession(adminUser);
  const testDate = '2026-11-20';
  const docId = 'd-test-token';
  const shiftId = 's-test-token';

  // 1. Create booking
  const booking = await api.createBookingAtomic({
    doctor_id: docId,
    shift_id: shiftId,
    booking_date: testDate,
    slot_index: 1,
    slot_time: '09:00',
    slot_time_formatted: '9:00 a.m.',
    reservation_type: 'Appointment',
    purpose: 'Consultation',
    source: 'Self',
    called_as: 'Hospital Patient',
    first_name: 'Zahid',
    last_name: 'Khan',
    phone_prefix: '300',
    phone_number: '1234567'
  });

  // Verify: NO token exists before check-in!
  assert.strictEqual(booking.token_number, null, 'Booking must NOT have a token number before check-in');
  assert.strictEqual(booking.token_code, null, 'Booking must NOT have a token code before check-in');
  assert.strictEqual(booking.status, 'pending', 'Booking status must be pending');

  // 2. First check-in by receptionist
  saveSession(receptionistUser);
  const checkin1 = await api.checkinBooking(booking.id);
  assert.strictEqual(checkin1.success, true);
  assert.strictEqual(checkin1.already_checked_in, false);
  const token1 = checkin1.token_number;
  assert.ok(token1 > 0, 'Token number must be a positive integer');

  // 3. Second check-in on the same booking
  const checkin2 = await api.checkinBooking(booking.id);
  assert.strictEqual(checkin2.success, true);
  assert.strictEqual(checkin2.already_checked_in, true, 'Double check-in must indicate already checked in');
  assert.strictEqual(checkin2.token_number, token1, 'Double check-in must return the exact same token');
});

// ------------------------------------------------------------------------------
// TEST 4: Receptionist can check in, operator cannot
// ------------------------------------------------------------------------------
await runAsyncTest('Receptionist can check in, operator cannot', async () => {
  const testDate = '2026-11-21';
  saveSession(adminUser);
  const booking = await api.createBookingAtomic({
    doctor_id: 'doc-role-test',
    shift_id: 'shift-role-test',
    booking_date: testDate,
    reservation_type: 'Appointment',
    purpose: 'Consultation',
    source: 'Phone call',
    called_as: 'Hospital Patient',
    first_name: 'Farhan',
    phone_number: '2345678'
  });

  // Operator attempts check-in -> REJECTED
  saveSession(operatorUser);
  let opFailed = false;
  try {
    await api.checkinBooking(booking.id);
  } catch (err) {
    opFailed = true;
    assert.match(err.message, /Receptionist and Admin/i);
  }
  assert.strictEqual(opFailed, true, 'Operator must NOT be allowed to check in patients');

  // Receptionist attempts check-in -> SUCCESS
  saveSession(receptionistUser);
  const res = await api.checkinBooking(booking.id);
  assert.strictEqual(res.success, true);
  assert.ok(res.token_number > 0);
});

// ------------------------------------------------------------------------------
// TEST 5: Token order matches check-in order, not booking order
// ------------------------------------------------------------------------------
await runAsyncTest('Token order matches check-in order, not booking order', async () => {
  saveSession(adminUser);
  const testDate = '2026-11-22';
  const docId = 'doc-order-test';
  const shiftId = 'shift-order-test';

  // Patient A booked for early slot (slot 1, 08:00)
  const bookingEarly = await api.createBookingAtomic({
    doctor_id: docId,
    shift_id: shiftId,
    booking_date: testDate,
    slot_index: 1,
    slot_time: '08:00',
    slot_time_formatted: '8:00 a.m.',
    reservation_type: 'Appointment',
    first_name: 'Patient-Early-Slot'
  });

  // Patient B booked for late slot (slot 10, 11:30)
  const bookingLate = await api.createBookingAtomic({
    doctor_id: docId,
    shift_id: shiftId,
    booking_date: testDate,
    slot_index: 10,
    slot_time: '11:30',
    slot_time_formatted: '11:30 a.m.',
    reservation_type: 'Appointment',
    first_name: 'Patient-Late-Slot'
  });

  // Patient Late arrives and checks in FIRST
  saveSession(receptionistUser);
  const lateCheckin = await api.checkinBooking(bookingLate.id);

  // Patient Early arrives and checks in SECOND
  const earlyCheckin = await api.checkinBooking(bookingEarly.id);

  assert.strictEqual(lateCheckin.token_number, 1, 'First to check in gets token 1 (regardless of slot time)');
  assert.strictEqual(earlyCheckin.token_number, 2, 'Second to check in gets token 2 (regardless of slot time)');
});

// ------------------------------------------------------------------------------
// TEST 6: Appointment and walk-in share one sequence (no A/W prefix)
// ------------------------------------------------------------------------------
await runAsyncTest('Appointment and walk-in share one numeric sequence', async () => {
  saveSession(adminUser);
  const testDate = '2026-11-23';
  const docId = 'doc-seq-test';
  const shiftId = 'shift-seq-test';

  // 1. Appointment patient
  const app1 = await api.createBookingAtomic({
    doctor_id: docId, shift_id: shiftId, booking_date: testDate,
    reservation_type: 'Appointment', first_name: 'App-1'
  });

  // 2. Walk-in patient
  const walk1 = await api.createBookingAtomic({
    doctor_id: docId, shift_id: shiftId, booking_date: testDate,
    reservation_type: 'Walk-in', first_name: 'Walk-1'
  });

  // 3. Another appointment
  const app2 = await api.createBookingAtomic({
    doctor_id: docId, shift_id: shiftId, booking_date: testDate,
    reservation_type: 'Appointment', first_name: 'App-2'
  });

  saveSession(receptionistUser);
  const c1 = await api.checkinBooking(app1.id);
  const c2 = await api.checkinBooking(walk1.id);
  const c3 = await api.checkinBooking(app2.id);

  assert.strictEqual(c1.token_number, 1);
  assert.strictEqual(c2.token_number, 2, 'Walk-in continues sequence after Appointment');
  assert.strictEqual(c3.token_number, 3, 'Appointment continues sequence after Walk-in');

  // Verify token code is plain number string, without 'A' or 'W' prefix
  assert.strictEqual(c1.token_code, '1');
  assert.strictEqual(c2.token_code, '2');
  assert.strictEqual(c3.token_code, '3');
});

// ------------------------------------------------------------------------------
// TEST 7: 20 parallel check-ins for one doctor give unique consecutive numbers 1..20
// ------------------------------------------------------------------------------
await runAsyncTest('20 parallel check-ins give unique consecutive numbers 1..20', async () => {
  saveSession(adminUser);
  const testDate = '2026-11-24';
  const docId = 'doc-parallel-test';
  const shiftId = 'shift-parallel-test';

  const bookingIds = [];
  for (let i = 1; i <= 20; i++) {
    const b = await api.createBookingAtomic({
      doctor_id: docId,
      shift_id: shiftId,
      booking_date: testDate,
      slot_index: i,
      reservation_type: i % 2 === 0 ? 'Walk-in' : 'Appointment',
      first_name: `Patient-${i}`
    });
    bookingIds.push(b.id);
  }

  saveSession(receptionistUser);
  // Perform 20 parallel check-ins
  const results = await Promise.all(bookingIds.map(id => api.checkinBooking(id)));

  const tokens = results.map(r => r.token_number);
  assert.strictEqual(tokens.length, 20);

  // Must have 20 unique numbers
  const uniqueTokens = new Set(tokens);
  assert.strictEqual(uniqueTokens.size, 20, 'All 20 tokens must be completely unique');

  // Sorted tokens must be exactly 1, 2, ..., 20
  const sorted = [...tokens].sort((a, b) => a - b);
  const expected = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.deepStrictEqual(sorted, expected, 'Tokens must form consecutive sequence 1 through 20');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests} / ${totalTests} passed`);
if (passedTests === totalTests) {
  console.log(`🎉 ALL TESTS PASSED!`);
  process.exit(0);
} else {
  console.error(`💥 SOME TESTS FAILED!`);
  process.exit(1);
}
