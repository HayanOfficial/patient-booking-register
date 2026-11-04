# Patient Booking Register (HIMS Front-Desk Appointment & Token System)

A desktop application designed for medical clinic front desks to manage doctor appointment schedules, sequential daily token numbering, waiting lists, source attribution analytics, and multi-user access control.

---

## 🎨 UI & Layout Fidelity

The interface replicates the reference design system:
- **Amber/Yellow Palette**: `#F59E0B` primary highlights, golden rounded pill badges, warm stat card accents.
- **Dark Header**: `#1E252B` slate header with live date indicator and status badges.
- **Stat Cards**: Dynamic counters for Total Bookings, Booked Slots %, Available %, Check-In %, In Process %, Pending %, Absent %, Follow-Up %, Remaining FU %, and dynamic per-channel patient acquisition counters (`Self`, `Facebook`, `TikTok`, `Website`, `WhatsApp`, `YouTube`, `Instagram`, `Referral`, `Phone call`). All cards are interactive and filter the booking table on click.
- **Main Register Table**: Exact column layout (`SR#`, `TIME`, `PATIENT IDENTIFICATION`, `SOURCE`, `PURPOSE`, `APPOINTMENT`, `VISIT INFO`, `ACTIONS`), with `Quick Book Slot` buttons spanning empty intervals.
- **Quick Book Modal**: Search Patient vs. Manual/Unknown toggle, purpose, reservation type, source, called-as, 13-digit CNIC validation, +92 phone with network prefixes (`300`...`349`), dependent City & Area selectors, age/DOB, and remarks.

---

## 🛠️ Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │                  React + TypeScript UI                  │
   │   (TailwindCSS, Lucide Icons, Recharts, Auth Context)   │
   └────────────────────────────┬────────────────────────────┘
                                │ ContextBridge IPC
   ┌────────────────────────────▼────────────────────────────┐
   │                Electron IPC Handlers Layer              │
   │               (Role & Permission Enforcer)              │
   └────────────────────────────┬────────────────────────────┘
                                │
   ┌────────────────────────────▼────────────────────────────┐
   │                     Services Layer                      │
   │  • SlotEngine (Interval generation & 12h formatting)    │
   │  • BookingService (Double-booking prevention)           │
   │  • TokenService (Sequential daily tokens)               │
   │  • AuthService (Bcrypt hashing, 5-attempt lockout)      │
   │  • AnalyticsService (Daily stats & trend aggregations)  │
   │  • BackupService (Auto 7-day rotation & restore)        │
   │  • SettingsService (Lookup lists, doctors, shifts)      │
   └────────────────────────────┬────────────────────────────┘
                                │
   ┌────────────────────────────▼────────────────────────────┐
   │                   Repositories Layer                    │
   │   • BaseRepository (Auto change_log writing for sync)   │
   │   • UserRepository (RBAC permissions matrix)            │
   │   • BookingRepository & PatientRepository               │
   │   • DoctorRepository, ShiftRepository, LookupRepository │
   │   • AuditRepository & SettingRepository                 │
   └────────────────────────────┬────────────────────────────┘
                                │
   ┌────────────────────────────▼────────────────────────────┐
   │               Embedded SQLite (Disk Storage)            │
   │      Auto-created in %APPDATA%/PatientBookingRegister   │
   └─────────────────────────────────────────────────────────┘
```

---

## 🔒 User Roles, Security & Access Control

1. **Role-Based Access Matrix**:
   - `Admin`: Full control over User Management, Settings, Doctors, Shifts, Full Analytics Reports, Security Logs, Backups, and Booking Deletions.
   - `Receptionist`: Front-desk operations only (View Bookings, Quick Book, Check-In patients, Mark Absent, Print Token Slips, Manage Waiting List). Administrative tabs are hidden in UI and restricted in the services layer.
2. **Password Security**: Passwords hashed with `bcryptjs`. Initial or reset accounts require a mandatory password update upon first login.
3. **Lockout Policy**: 5 consecutive failed login attempts lock the account for 5 minutes.
4. **Last Active Admin Protection**: The system prevents demoting or disabling the last active Administrator account.
5. **Master Recovery Key**: First-run setup generates a master recovery key (`RECOVER-PBR-7849-AK92-X901`) allowing the clinic owner to reset the Admin password without internet or email.
6. **Audit Trail**: Every login, logout, password change, booking creation, edit, deletion, and status change is recorded with timestamps and payload diffs.

---

## 🎟️ Tokens & Printing Formats

- **Auto Sequential Reset**: Tokens start at `1` each morning per doctor and shift.
- **Prefix Differentiation**:
  - `A-01`, `A-02`... for Scheduled Appointments.
  - `W-01`, `W-02`... for Walk-in Patients.
- **Print Slips**:
  - **80mm Thermal Receipt**: Formatted with clinic header, bold token number, slot time, doctor, patient details, and cut separator lines.
  - **A5 Standard Slip**: Professional landscape layout with barcode/token box and clinic branding.

---

## 💾 Backups & Data Integrity

- **Automatic Daily Backups**: Daily database snapshots saved to `backups/`, automatically keeping the last 7 backups.
- **Manual Snapshots**: Point-in-time snapshot creation on demand.
- **Restore**: One-click database restoration with automatic safety snapshot before replacement.
- **App Update Safety**: Data resides in `%APPDATA%/PatientBookingRegister/data/` and is never removed during updates or uninstalls.

---

## 🌐 Future P2P / LAN Multi-PC Synchronization

The database is built with sync primitives:
1. **UUID Primary Keys**: Every table uses a UUID v4 `id` preventing primary key collisions across multiple PCs.
2. **Metadata Columns**: Every record includes `created_at`, `updated_at`, `deleted_at` (soft deletes), and `device_id` (e.g. `DEV1`, `DEV2`).
3. **`change_log` Audit Table**: The `BaseRepository` automatically records every `INSERT`, `UPDATE`, and `DELETE` with full JSON payload and a `synced` flag.
4. **Token Device Prefixes**: Token generation can optionally format tokens as `DEV1-A-01` to ensure unique tokens across multiple reception terminals.

### How to plug in LAN / Tailscale P2P Sync:
1. Connect reception PCs to the same Local Area Network (LAN) or a private Tailscale virtual network.
2. Run a background synchronization worker (e.g., SQLite CRDT / LiteFS / WebSockets) that polls `change_log WHERE synced = 0`.
3. Push changes to peer machines and apply incoming deltas using "Last-Write-Wins" on `updated_at`.

---

## 🚀 Running & Building

### Prerequisites
- Node.js (v18+)
- npm

### Development Mode
```bash
npm run electron:dev
```

### Running Test Suite
```bash
npm test
```

### Build Windows Installer (.exe)
```bash
npm run package
```
The resulting NSIS setup `.exe` will be generated in `/release`.

---

## 📋 Default Credentials

- **Admin Account**: `admin` / `admin123`
- **Receptionist Account**: `receptionist` / `reception123`
- **Master Recovery Key**: `RECOVER-PBR-7849-AK92-X901`
