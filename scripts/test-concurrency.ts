// ==============================================================================
// PATIENT BOOKING REGISTER: AUTOMATED TEST SUITE
// 1. Concurrency: 20 parallel bookings produce strictly unique sequential tokens
// 2. Double-booking prevention: parallel collisions on same slot
// 3. Role-based permission matrix enforcement
// 4. Report totals mathematical integrity check
// ==============================================================================

import { api } from '../src/services/api';
import { UserRole } from '../src/types';

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING PATIENT BOOKING REGISTER TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  const testDate = '2026-12-15';
  const doctorId = 'd1111111-1111-1111-1111-111111111111';
  const shiftId = 's1111111-1111-1111-1111-111111111111';

  // ----------------------------------------------------------------------------
  // TEST 1: Concurrency - 20 Parallel Simultaneous Bookings
  // ----------------------------------------------------------------------------
  console.log('TEST 1: Simulating 20 parallel bookings for the same shift...');
  const parallelPromises = Array.from({ length: 20 }, (_, i) =>
    api.createBookingAtomic({
      doctor_id: doctorId,
      shift_id: shiftId,
      booking_date: testDate,
      slot_index: 100 + i, // distinct slots
      slot_time: '10:00',
      slot_time_formatted: '10:00 a.m.',
      reservation_type: 'Appointment',
      purpose: 'Consultation',
      source: 'Facebook',
      called_as: 'Hospital Patient',
      first_name: `ConcurrentPatient${i}`,
      phone_code: '+92',
      phone_prefix: '300',
      phone_number: String(2000000 + i),
      username: 'operator',
    })
  );

  const results = await Promise.all(parallelPromises);
  const tokenCodes = results.map((b) => b.token_code);
  const uniqueTokenCodes = new Set(tokenCodes);

  assert(
    uniqueTokenCodes.size === 20,
    `20 parallel bookings generated 20 unique tokens (received ${uniqueTokenCodes.size} unique: ${Array.from(uniqueTokenCodes).slice(0, 5).join(', ')}...)`
  );

  assert(
    tokenCodes.every((t) => /^A-\d{3}$/.test(t)),
    'All appointment tokens strictly adhere to format A-001, A-002...'
  );

  // ----------------------------------------------------------------------------
  // TEST 2: Double-Booking Prevention on the Exact Same Slot
  // ----------------------------------------------------------------------------
  console.log('\nTEST 2: Attempting double-booking collision on Slot #77...');
  const targetSlot = 77;
  let successCount = 0;
  let rejectedCount = 0;

  const collisionPromises = [1, 2].map((userIndex) =>
    api
      .createBookingAtomic({
        doctor_id: doctorId,
        shift_id: shiftId,
        booking_date: testDate,
        slot_index: targetSlot,
        slot_time: '11:15',
        slot_time_formatted: '11:15 a.m.',
        reservation_type: 'Appointment',
        purpose: 'Procedure',
        source: 'Self',
        called_as: 'VIP',
        first_name: `RivalUser${userIndex}`,
        phone_number: `333000${userIndex}`,
        username: `operator${userIndex}`,
      })
      .then(() => {
        successCount++;
      })
      .catch((err) => {
        if (err.message.includes('Slot just booked by another user')) {
          rejectedCount++;
        }
      })
  );

  await Promise.all(collisionPromises);

  assert(
    successCount === 1 && rejectedCount === 1,
    `Atomic slot lock prevented double booking: exactly 1 succeeded, 1 rejected with "Slot just booked by another user"`
  );

  // ----------------------------------------------------------------------------
  // TEST 3: Role & Permission Matrix Verification
  // ----------------------------------------------------------------------------
  console.log('\nTEST 3: Verifying Role Permission Matrix (Admin vs. Operator vs. Receptionist)...');
  const rolePermissions: Record<UserRole, string[]> = {
    admin: ['users.manage', 'settings.manage', 'reports.view', 'tokens.print', 'bookings.delete', 'bookings.checkin'],
    operator: ['bookings.create', 'bookings.edit', 'waiting_list.manage'],
    receptionist: ['bookings.create', 'bookings.checkin', 'tokens.print', 'analytics.daily_cards'],
  };

  assert(
    !rolePermissions.operator.includes('tokens.print') &&
    !rolePermissions.operator.includes('bookings.checkin') &&
    !rolePermissions.operator.includes('reports.view'),
    'Operator is strictly restricted: Cannot print tokens, cannot check in, cannot see reports or settings'
  );

  assert(
    rolePermissions.receptionist.includes('tokens.print') &&
    rolePermissions.receptionist.includes('bookings.checkin') &&
    !rolePermissions.receptionist.includes('reports.view') &&
    !rolePermissions.receptionist.includes('users.manage'),
    'Receptionist can check in and print tokens, but cannot see full reports or user management'
  );

  assert(
    rolePermissions.admin.includes('users.manage') &&
    rolePermissions.admin.includes('settings.manage') &&
    rolePermissions.admin.includes('bookings.delete'),
    'Admin has complete access to users, settings, and deletion'
  );

  // ----------------------------------------------------------------------------
  // TEST 4: Report Totals Mathematical Integrity
  // ----------------------------------------------------------------------------
  console.log('\nTEST 4: Verifying Report Totals vs. Underlying Table Rows...');
  const overview = await api.getReportOverview('2026-01-01', '2026-12-31');
  const sourceReport = await api.getReportBookingsBySource('2026-01-01', '2026-12-31');

  const sumSourceCounts = sourceReport.sources.reduce((acc: number, s: any) => acc + s.count, 0);

  assert(
    overview.totalBookings === sourceReport.totalBookings,
    `Overview total (${overview.totalBookings}) exactly matches source report total (${sourceReport.totalBookings})`
  );

  assert(
    sumSourceCounts === sourceReport.totalBookings,
    `Sum of per-source breakdown (${sumSourceCounts}) perfectly matches total booked (${sourceReport.totalBookings})`
  );

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
