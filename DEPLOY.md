# Production Deployment Guide: Patient Booking Register (HIMS)
**Host**: Vercel &bull; **Bundler**: Vite (Vanilla Multi-Page) &bull; **Database / Auth / Realtime**: Supabase &bull; **Timezone**: Asia/Karachi (UTC+5)

This application is built with vanilla HTML, hand-crafted CSS, and modular ES JavaScript bundled by Vite with zero UI framework dependencies.

---

## 1. Vercel Hosting Configuration

When deploying this repository to Vercel:

| Setting | Value |
| :--- | :--- |
| **Framework Preset** | `Vite` (or `Other`) |
| **Root Directory** | `./` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Serverless Functions
Admin actions (`create-user`, `delete-user`, `reset-password`) are handled by serverless functions in `/api` running plain Node.js.
These functions read `SUPABASE_SERVICE_ROLE_KEY` exclusively from Vercel's private environment variables.

---

## 2. Environment Variables in Vercel

Under **Project Settings &rarr; Environment Variables**, add the following:

| Variable Name | Environment | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Production, Preview, Development | Public URL of your Supabase project (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview, Development | Safe public anonymous key for browser database reads and Realtime events |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Development | **Secret** service role key used **only** by `/api` serverless functions for admin actions |
| `VITE_APP_TIMEZONE` | Production, Preview, Development | `Asia/Karachi` |

> [!WARNING]
> Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `VITE_`. It must remain private on the server.

---

## 3. Database & Realtime Setup (Supabase)

### Step 3.1: Execute Schema & Migrations
In your Supabase project dashboard:
1. Open **SQL Editor**.
2. Run [`supabase/full_schema_and_seed.sql`](./supabase/full_schema_and_seed.sql).
   This creates:
   - All tables: `bookings`, `patients`, `doctors`, `shifts`, `lookup_items`, `waiting_list`, `token_counters`, `clinic_settings`, `user_profiles`, `roles_permissions`, `audit_logs`.
   - Stored procedures: `create_booking_atomic`, `reprint_token`, `update_booking_status`, `login_user`, `change_user_password`.
   - Realtime replication configuration on `bookings`, `waiting_list`, `patients`, `user_profiles`.
   - Default seed accounts:
     - **Admin**: `admin` / `admin123`
     - **Operator**: `operator` / `operator123`
     - **Receptionist**: `receptionist` / `reception123`

### Step 3.2: Verify Realtime
In Supabase:
1. Go to **Database &rarr; Replication**.
2. Confirm `supabase_realtime` has `bookings`, `waiting_list`, `patients`, `user_profiles` enabled.
3. Confirm tables have `REPLICA IDENTITY FULL`.

---

## 4. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start Vite local development server
npm run dev

# 3. Build for production preview
npm run build
npm run preview
```

Open `http://localhost:5173` to sign in. Default login credentials:
- Username: `admin` | Password: `admin123`
- Username: `operator` | Password: `operator123`
- Username: `receptionist` | Password: `reception123`

---

## 5. Deployment Verification Checklist

- [x] All file paths relative (no `C:\` or local drive references).
- [x] All file and folder names lowercase with no spaces.
- [x] Tested with `npm run build` &mdash; compiles to `dist/` with zero errors.
- [x] Tested with `npm run preview` &mdash; all pages and bundled CSS/JS assets serve with HTTP 200 without any 404s.
- [x] Realtime indicator shows "● Live" when connected.
- [x] Cross-tab BroadcastChannel sync verified for multi-window testing.
