import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Patient Booking Register | HIMS Front-Desk Appointment & Token System',
  description: 'Enterprise doctor appointment schedule, atomic token sequence, and realtime HIMS front-desk register.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-slate-900">{children}</body>
    </html>
  );
}
