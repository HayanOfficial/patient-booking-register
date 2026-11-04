import { format, parseISO } from 'date-fns';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}/${y}`;
  } catch {
    return dateStr;
  }
}

export function parseDateFromDisplay(displayStr: string): string {
  try {
    const [m, d, y] = displayStr.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } catch {
    return displayStr;
  }
}

export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatPakistanPhone(code: string, prefix: string, number: string): string {
  return `${code}${prefix}${number}`;
}
