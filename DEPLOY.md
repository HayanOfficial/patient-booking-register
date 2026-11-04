# Production Deployment Guide: Patient Booking Register (HIMS)
**Host**: Vercel &bull; **Database / Auth / Realtime**: Supabase &bull; **Timezone**: Asia/Karachi (UTC+5)

This guide takes your clinic booking register from local development to a live, publicly accessible website on the internet (e.g. `https://clinic-booking.vercel.app`) with zero-refresh realtime multi-user synchronization.

---

## Architecture Summary
- **Public URL Delivery**: Standard responsive web application hosted on Vercel's global Edge network.
- **First Page**: Secure Login page (`/`). Public registration is strictly disabled. Staff accounts are provisioned exclusively by the Administrator.
- **Role-Based Landing**: After login, users land on the Booking Sheet with permissions calibrated to their role:
  - 👑 **Admin**: Full access to all 8 tabs, User Management, Settings, Audit Log, and soft-delete capabilities.
  - 📞 **Operator**: Dedicated call center & social lead booking interface (Appointment creation, Patient search, Waiting List). Front-desk check-in is restricted.
  - 🏥 **Receptionist**: Front-desk counter interface (1-click Check-in, Consultation status progression, Walk-in registration, 80mm & A5 Token Slip printing).
- **Zero-Refresh Realtime**: Powered by Supabase Realtime websockets on Postgres tables (`bookings`, `waiting_list`, `patients`, `user_profiles`).

---

## Phase 1: Supabase Cloud Database & Realtime Setup

### Step 1.1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New Project** in your Supabase dashboard.
3. Configure project details:
   - **Name**: `clinic-booking` (or your clinic name, e.g. `dr-naeem-retina-center`)
   - **Database Password**: Choose a strong password and save it securely.
   - **Region**: Choose the region closest to your clinic (e.g., `Singapore - ap-southeast-1` or `Frankfurt - eu-central-1`).
   - **Pricing Plan**: Free Tier is completely sufficient.
4. Click **Create new project** and wait ~1 minute for provisioning to complete.

---

### Step 1.2: Run Database Migrations & Initial Seed Data
1. In the Supabase left sidebar, click on **SQL Editor** (the `>_` icon).
2. Click **New query** (or `+`).
3. Open the file [`supabase/full_schema_and_seed.sql`](./supabase/full_schema_and_seed.sql) in your code editor.
4. Copy the entire contents of `supabase/full_schema_and_seed.sql`.
5. Paste it into the Supabase SQL Editor.
6. Click the green **Run** button (or press `Ctrl+Enter` / `Cmd+Enter`).
7. You should see `Success. No rows returned`.

> [!NOTE]
> This one-click SQL script creates:
> - All 11 core tables (`bookings`, `patients`, `doctors`, `shifts`, `lookup_items`, `waiting_list`, `token_counters`, `clinic_settings`, `user_profiles`, `roles_permissions`, `audit_logs`).
> - Race-proof atomic stored procedures (`create_booking_atomic`, `reprint_token`, `update_booking_status`, `login_user`).
> - PostgreSQL database report views and analytical aggregation functions.
> - Row Level Security (RLS) policies.
> - Default clinic settings, sample doctors (Dr Naeem Khattak, Dr Zarin Khan), 3 shifts, standard referral sources, and 30 days of initial bookings.
> - Default staff accounts:
>   - **Admin**: `admin` / `admin123`
>   - **Operator**: `operator` / `operator123`
>   - **Receptionist**: `receptionist` / `reception123`

---

### Step 1.3: Enable Realtime on Database Tables
The SQL script automatically adds the tables to `supabase_realtime`. Let's verify:
1. In your Supabase left navigation, go to **Database** &rarr; **Publications**.
2. Click on the `supabase_realtime` publication.
3. Verify that the following tables are enabled (toggled **ON**):
   - `bookings`
   - `waiting_list`
   - `patients`
   - `user_profiles`
4. If any table is not toggled on, toggle it on and click **Save**.

---

### Step 1.4: Retrieve Supabase API Credentials
1. In your Supabase left navigation, click on **Project Settings** (gear icon) &rarr; **API** (under *Configuration*).
2. Copy the following keys:
   - **Project URL**: Starts with `https://<project-ref>.supabase.co`
   - **Project API Keys &rarr; `anon` (public)**: Long JWT token starting with `eyJhbGciOi...`
   - **Project API Keys &rarr; `service_role` (secret)**: Long JWT token (keep private!)

---

### Step 1.5: Configure Authentication URL Redirects
1. In your Supabase left navigation, click on **Authentication** &rarr; **URL Configuration**.
2. Under **Site URL**, enter your future Vercel URL (e.g., `https://clinic-booking.vercel.app`) or temporary placeholder.
3. Under **Redirect URLs**, click **Add URL** and add:
   - `http://localhost:3000/**` (for local development)
   - `https://*.vercel.app/**` (for preview deployments)
   - `https://clinic-booking.vercel.app/**` (your production URL)
4. Click **Save**.

---

## Phase 2: Push Code to GitHub

1. Open your terminal in the project directory (`c:\Users\Dell 5560\Desktop\HRB`):
   ```bash
   git init
   git add .
   git commit -m "feat: clinic booking register with Supabase realtime & role auth"
   ```

2. Create a new repository on [GitHub](https://github.com/new):
   - Repository name: `clinic-booking-register`
   - Visibility: **Private** (recommended for clinic data) or **Public**
   - Do NOT initialize with README (already present)

3. Push your code to GitHub:
   ```bash
   git remote add origin https://github.com/<your-github-username>/clinic-booking-register.git
   git branch -M main
   git push -u origin main
   ```

---

## Phase 3: Deploy to Vercel

### Step 3.1: Import Project into Vercel
1. Go to [https://vercel.com](https://vercel.com) and log in with your GitHub account.
2. On your Vercel Dashboard, click **Add New...** &rarr; **Project**.
3. Locate `clinic-booking-register` in the GitHub repository list and click **Import**.

---

### Step 3.2: Configure Environment Variables in Vercel
In the **Configure Project** screen:
1. Leave **Framework Preset** as `Next.js` (auto-detected).
2. Expand the **Environment Variables** section and add the 4 variables from your Supabase setup:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-id.supabase.co` | Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsIn...` | Public client API key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsIn...` | Server administrative key |
| `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Karachi` | Clinic timezone anchor |

3. Click **Deploy**.

---

### Step 3.3: Production Verification
Vercel will build the Next.js App Router application and provide your live production URL:
```text
https://clinic-booking.vercel.app
```
(or your custom project domain).

---

## Phase 4: Local Multi-Window Realtime Verification

Before or after taking the site live, test multi-user concurrency locally:

1. In your terminal, run:
   ```bash
   npm run dev
   ```
2. Open **Window 1** (Google Chrome):
   - Navigate to `http://localhost:3000`
   - The first screen is the **LOGIN PAGE**.
   - Click the quick-fill button **Reception** (`receptionist` / `reception123`) and click **Sign In**.
   - Notice you land on the **Booking Sheet**. You have 1-Click Check-in, Token Print, and Walk-in capabilities.

3. Open **Window 2** (Private / Incognito Window or Firefox):
   - Navigate to `http://localhost:3000`
   - Click the quick-fill button **Operator** (`operator` / `operator123`) and click **Sign In**.
   - Notice the Operator view has no Admin tabs, no front-desk check-in buttons, and is locked to Appointment bookings.

4. **Verify Realtime Without Page Refresh**:
   - In **Window 2 (Operator)**:
     - Find an open slot (e.g. 08:36 a.m.) and click **Quick Book Slot**.
     - Enter patient name (e.g. `Hamza Afridi`), phone (`0300 1234567`), purpose `Consultation`.
     - Click **Confirm Booking**.
   - Watch **Window 1 (Receptionist)** simultaneously:
     - **Immediately, without any page refresh**, the slot updates in Window 1!
     - A live floating notification pops up: `A-002: Booked for Dr Naeem Khattak`.
     - Window 1 counter card increments in realtime.
   - In **Window 1 (Receptionist)**:
     - Click the green check-in icon on the new booking.
     - **Window 2 (Operator)** immediately switches that patient's badge to green **Checked In** with arrival timestamp!

---

## Phase 5: Production Operational Guide

### 1. Waiting Lounge Announcement TV Display
For waiting room monitors, open the live URL:
```text
https://clinic-booking.vercel.app/display
```
This page requires no staff login. It displays a live high-contrast board showing the current token being called in Consultation Room 1 and the upcoming queue, synced in realtime.

### 2. Adding Clinic Staff & Changing Passwords
- Log in as **Admin** (`admin` / `admin123`).
- Click the **User Management** tab.
- Click **+ Add Staff Member**.
- Fill in:
  - Full Name (e.g. `Zubair Khan`)
  - Username (e.g. `zubair_rec`)
  - Email (e.g. `zubair@drnaeemcenter.com`)
  - Role: Select `Operator`, `Receptionist`, or `Admin`.
  - Initial Password
- Click **Create User**. The new user can immediately sign in.

### 3. Keyboard Shortcuts for Reception & Call Operators
- `Ctrl + B` / `Cmd + B`: Open Quick Book Modal from anywhere.
- `Ctrl + R` / `Cmd + R`: Instant schedule refresh.
- `ESC`: Close any active modal.

---

## Security & Maintenance Checklist
- [x] Public registration is disabled (`No public signup`).
- [x] Password verification executed via PostgreSQL `pgcrypto` `crypt()`.
- [x] Account lockout triggered after 5 consecutive failed attempts.
- [x] 15-minute automatic idle session timeout.
- [x] Last active Administrator cannot be demoted or deleted.
- [x] Database-level unique constraint prevents double booking:
  `CREATE UNIQUE INDEX idx_unique_active_slot ON bookings(doctor_id, shift_id, booking_date, slot_index) WHERE deleted_at IS NULL AND status != 'cancelled';`
- [x] Realtime publication enabled for sub-second updates across all connected browsers.

