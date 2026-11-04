# Patient Booking Register (HIMS Front-Desk Appointment & Token System)

A production-ready web application for clinical front-desks, appointment management, race-proof atomic daily token numbering, waiting lists, multi-channel patient acquisition analytics, and role-based access control.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL, Realtime, RLS)**, deployed on **Vercel**.

---

## 🎨 Design & Visual Fidelity

The interface replicates the reference design system (`reference/`):
- **Amber/Yellow Palette**: `#F59E0B` primary highlights, golden rounded pill badges, warm stat card accents.
- **Dark Header**: `#1E252B` slate header with live date indicator, real-time connection status pill (`Live` / `Reconnecting` / `Offline`), and user profile/role switcher.
- **Interactive Stat Cards**: Dynamic counters for **Total Bookings**, **Booked Slots %**, **Available %**, **Check-In %**, **In Process %**, **Pending %**, **Absent %**, **Follow-Up %**, **Remaining FU %**, and per-channel acquisition counters (`Self`, `Facebook`, `TikTok`, `Website`, `WhatsApp`, `YouTube`, `Instagram`, `Referral`, `Phone call`). All cards are interactive and filter the booking table on click.
- **Main Register Table**: Column layout (`SR#`, `TIME`, `PATIENT IDENTIFICATION`, `SOURCE`, `PURPOSE`, `APPOINTMENT`, `VISIT INFO`, `ACTIONS`). Empty slot intervals feature full-span centered **`+ Quick Book Slot`** buttons.
- **Quick Book Modal**: Exact replica of `Booking page.png`: slot time in large bold typography, Doctor / Shift / Clinic badges, **[Search Patient]** vs. **[Manual / Unknown]** toggle, 13-digit CNIC validation, +92 Pakistani mobile network prefix selector (`300`–`349`) with 7-digit validation, dependent City & Area selectors, age, and remarks.
- **Queue Display Board (`/display`)**: Live "Now Serving" LED/TV display showing the currently serving token and patient, room number, live Pakistan Standard Time, and the upcoming queue.

---

## 🔒 Three User Roles & Security Matrix

Permissions are enforced at the database layer (PostgreSQL Row Level Security) and server actions:

| Permission / Feature | Admin | Operator | Receptionist |
|---|:---:|:---:|:---:|
| Search / Register Patients | ✅ | ✅ | ✅ |
| Create Appointment Bookings | ✅ | ✅ | ✅ |
| Edit Appointment Details | ✅ | ✅ | ✅ |
| Add to Waiting List | ✅ | ✅ | ✅ |
| Book Walk-in Patients | ✅ | ❌ | ✅ |
| Front-Desk Check-In | ✅ | ❌ | ✅ |
| Mark Absent / In-Process / Completed | ✅ | ❌ | ✅ |
| Print & Reprint Token Slips | ✅ | ❌ | ✅ |
| Daily Stat Cards | ✅ | ❌ | ✅ |
| Full Analytical Reports & BI | ✅ | ❌ | ❌ |
| Manage Clinic Settings & Lookups | ✅ | ❌ | ❌ |
| Manage System Users & Passwords | ✅ | ❌ | ❌ |
| Soft Delete & Restore Bookings | ✅ | ❌ | ❌ |
| Security & Operational Audit Log | ✅ | ❌ | ❌ |

- **No Public Signup**: User accounts are created exclusively by the Administrator.
- **Password Policies**: Initial accounts require a mandatory password update upon first login (`must_change_password`).
- **Account Lockout**: 5 consecutive failed login attempts lock the account for 5 minutes.
- **Last Active Admin Protection**: The database function and API strictly prevent demoting or disabling the last active Administrator.
- **Idle Auto-Logout**: Inactive sessions automatically log out after 15 minutes.

---

## 🎟️ Atomic & Race-Proof Token System

Tokens are allocated **exclusively by PostgreSQL** inside an atomic transaction:

1. **Format**:
   - `A-001`, `A-002`... for Scheduled Appointments.
   - `W-001`, `W-002`... for Walk-in Patients.
   - Resets daily at midnight **Asia/Karachi** (`UTC+5`).
2. **Atomic Counter Table (`token_counters`)**:
   Keyed by `(doctor_id, shift_id, booking_date, reservation_type)`. Incremented via `INSERT ... ON CONFLICT DO UPDATE RETURNING current_token_no`. Parallel transactions hitting the database at the exact same millisecond queue on row-level locks, ensuring strictly unique sequential tokens with zero duplicate numbers.
3. **Double-Booking Slot Prevention**:
   Partial unique index:
   ```sql
   CREATE UNIQUE INDEX idx_unique_active_slot 
   ON public.bookings(doctor_id, shift_id, booking_date, slot_index) 
   WHERE deleted_at IS NULL AND status != 'cancelled';
   ```
   If two receptionists submit the same slot simultaneously, the second is rejected with: *"Slot just booked by another user"*.
4. **Token History & Reprints**:
   Cancelled or absent tokens are never reused. Reprints keep the original token and record an audit entry.
5. **Printable Token Slips**:
   - **80mm Thermal Receipt**: Formatted with clinic branding, token number box, slot time, doctor, patient details, and a scannable QR code.
   - **A5 Standard Slip**: Professional landscape layout.

---

## 📊 Reports & Visualizations (Recharts)

All aggregation happens **inside PostgreSQL** using dedicated RPC functions:
1. **Overview Dashboard**: Total volume, attended, absent, completed, absenteeism rate %, average per day, and daily trajectory line chart.
2. **Bookings by Source**: Distribution table + Pie chart with conversion rates per channel.
3. **Booking Trends**: Daily, weekly, and monthly trends (Appointments vs. Walk-ins vs. Attended).
4. **Peak Hours & Heatmap**: Hourly distribution bar chart and weekday patient load.
5. **Staff Performance**: Productivity metrics per operator/receptionist.
6. **Shift Utilisation**: Slot utilisation % and doctor workload.
7. **Token Report**: Daily allocation breakdown (`A-Tokens` vs. `W-Tokens`, reprints, cancelled).
8. **Absent & Follow-up Register**: Exportable patient roster with contact details.
- **Export Capabilities**: Instant export to **CSV**, **Excel (.xlsx)**, and **PDF** (via jsPDF + autoTable).

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- Node.js 18+ (tested on Node v20/v26)
- npm 9+

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Configure your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
NEXT_PUBLIC_APP_TIMEZONE=Asia/Karachi
```
*(Note: If Supabase credentials are not yet configured, the app automatically runs in resilient in-memory mode preloaded with 30 days of sample data, allowing full demonstration and testing).*

### 4. Apply Database Migrations (Supabase)
Run the migration scripts in order using the Supabase CLI or SQL Editor:
```bash
# 1. Core schema, RLS, and permissions
supabase/migrations/20261102000001_initial_schema.sql

# 2. Atomic token RPC and double-booking locks
supabase/migrations/20261102000002_token_rpc.sql

# 3. High-performance report functions and views
supabase/migrations/20261102000003_reports_views.sql

# 4. Realistic seed data (Doctors, Shifts, Lookups, 30 days of bookings)
supabase/seed.sql
```

### 5. Run the Application
```bash
# Development mode
npm run dev

# Production build & start
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
Open [http://localhost:3000/display](http://localhost:3000/display) for the lobby "Now Serving" board.

---

## 🧪 Automated Testing

A dedicated test suite validates the core business rules and concurrency requirements:
```bash
npx tsx scripts/test-concurrency.ts
```

Tests verified:
1. **Concurrency**: 20 parallel simultaneous bookings produce 20 strictly distinct sequential tokens (`A-001` through `A-020`).
2. **Double-Booking Prevention**: Simultaneous collisions on the exact same slot result in 1 success and 1 error (`"Slot just booked by another user"`).
3. **Role Permission Matrix**: Verifies restrictions for Operator (no check-in, no token print, no reports), Receptionist, and Admin.
4. **Report Totals Mathematical Integrity**: Verifies that report totals exactly equal the sum of table rows.

---

## ☁️ Deploying to Vercel

1. Push your repository to GitHub / GitLab.
2. In the Vercel Dashboard, select **Add New Project** and import the repository.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (ensure this is marked as a server-side secret)
   - `NEXT_PUBLIC_APP_TIMEZONE=Asia/Karachi`
4. Click **Deploy**. Vercel will build the Next.js App Router application and provide your production URL.

---

## 🔑 Default Accounts (Seed Data)

| Username | Password | Role | Description |
|---|---|---|---|
| `admin` | `admin123` | Administrator | Full administrative control, settings, user management, and all 8 reports |
| `operator` | `operator123` | Call Operator | Patient registration and appointment booking from phone/social media leads |
| `receptionist` | `reception123` | Receptionist | Front-desk walk-ins, check-in, token printing, and queue management |

*(Use the role dropdown in the header to switch between accounts instantly during testing).*
