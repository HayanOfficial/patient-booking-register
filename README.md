# Patient Booking Register (HIMS Front-Desk)

A high-performance, real-time clinical front-desk scheduling and token management register for **Bariatric Surgery Clinic** and specialist practices.

Built with **plain HTML pages, hand-written CSS, and vanilla ES JavaScript modules** bundled by **Vite**, with PostgreSQL & Realtime powered by **Supabase**.

---

## Architecture & Tech Stack

- **Frontend**: Plain HTML5, CSS3 (variables, flexbox, CSS grid, custom scrollbars), Vanilla JavaScript (ES modules).
  - **No React**, **No Next.js**, **No Vue**, **No TypeScript**, **No Tailwind**, **No UI frameworks**.
  - Any file can be opened, read, and maintained directly.
- **Bundler & Dev Server**: Vite in vanilla multi-page mode (`vite.config.js`).
- **Libraries**:
  - `@supabase/supabase-js` &mdash; Supabase client & Realtime websockets.
  - `chart.js` &mdash; Charts & trend visualizations on the Reports and Analytics pages.
  - `xlsx` &mdash; Client-side Excel export for reports.
- **Backend**:
  - Plain Node.js serverless functions in `/api` for admin user provisioning (`create-user.js`, `delete-user.js`, `reset-password.js`).
  - Stored procedures in PostgreSQL (`create_booking_atomic`, `reprint_token`, `update_booking_status`, `login_user`).
- **Hosting**: Vercel (`dist/` directory).

---

## File Structure

```
├── index.html            # Staff sign-in page
├── booking.html          # Main booking register & schedule sheet
├── reports.html          # 8 clinical analytics and performance reports
├── settings.html         # Clinic profile, doctors, shifts, lookups, audit trail
├── users.html            # Staff accounts & role-based access control
├── display.html          # TV screen queue display for waiting area
├── print-token.html      # 80mm thermal token slip print view
├── css/
│   ├── style.css         # Single shared hand-written stylesheet
│   └── print.css         # Print-specific styles
├── js/
│   ├── supabase.js       # Supabase client initialization (anon key)
│   ├── auth.js           # Staff authentication & session guard
│   ├── api.js            # Unified API (Supabase RPCs + resilient local fallback)
│   ├── slot-engine.js    # Shift slot interval generator
│   ├── utils.js          # Formatters, toasts, modals, status labels
│   ├── realtime.js       # Realtime connection & broadcast channel
│   ├── booking.js        # Controller for booking.html
│   ├── reports.js        # Controller for reports.html (Chart.js + XLSX)
│   ├── settings.js       # Controller for settings.html
│   ├── users.js          # Controller for users.html
│   └── display.js        # Controller for display.html
├── api/
│   ├── create-user.js    # Admin-only serverless user creation
│   ├── delete-user.js    # Admin-only user deactivation
│   └── reset-password.js # Admin-only staff password reset
├── supabase/
│   ├── migrations/       # SQL migrations
│   └── full_schema_and_seed.sql # Master DB schema & seed data
├── vite.config.js        # Multi-page input rollup configuration
├── package.json          # Node dependencies and build scripts
├── DEPLOY.md             # Complete Vercel & Supabase deployment guide
└── .env.example          # Environment variable template
```

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
npm install
```

### Local Development
```bash
npm run dev
```

### Production Build & Preview
```bash
npm run build
npm run preview
```

### Default Credentials
- **Admin**: `admin` / `admin123`
- **Operator**: `operator` / `operator123`
- **Receptionist**: `receptionist` / `reception123`

---

## Realtime & Offline Architecture
1. **Supabase Realtime**: Subscribes to postgres changes on `bookings`, `waiting_list`, and `patients`. The DOM updates in-place with zero page reloads.
2. **Cross-Tab Synchronization**: Uses `BroadcastChannel` so multi-window testing updates instantly across all open browser tabs even without database connectivity.
3. **Resilient Local Mock Layer**: When `VITE_SUPABASE_URL` is unconfigured, the app seamlessly runs on a full in-memory dataset matching `seed.sql`.
