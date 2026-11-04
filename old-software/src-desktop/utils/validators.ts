export function validateCnic(cnic?: string): { isValid: boolean; error?: string } {
  if (!cnic || cnic.trim() === '') return { isValid: true };
  const cleaned = cnic.replace(/\D/g, '');
  if (cleaned.length > 0 && cleaned.length !== 13) {
    return { isValid: false, error: 'CNIC should be 13 digits (or leave blank).' };
  }
  return { isValid: true };
}

export function formatCnic(cnic?: string): string {
  if (!cnic) return '';
  const cleaned = cnic.replace(/\D/g, '').slice(0, 13);
  if (cleaned.length <= 5) return cleaned;
  if (cleaned.length <= 12) return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
}

export function validatePhone(phone: string): { isValid: boolean; error?: string } {
  if (!phone || phone.trim() === '') {
    // Phone is optional or can be partial
    return { isValid: true };
  }
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length > 0 && cleaned.length < 5) {
    return { isValid: false, error: 'Please enter a valid phone number (at least 5 digits).' };
  }
  return { isValid: true };
}
