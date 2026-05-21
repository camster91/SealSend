/**
 * Phone number validation and formatting utilities
 * Uses libphonenumber-js for robust phone handling
 */

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export interface PhoneValidationResult {
  valid: boolean;
  formatted?: string; // E.164 format
  country?: string;
  error?: string;
}

/**
 * Validate and format a phone number to E.164 format
 * 
 * @param phone - Phone number string (e.g., "+1 555-123-4567" or "(555) 123-4567")
 * @param defaultCountry - ISO country code for parsing (default: 'US')
 * @returns Validation result with formatted number if valid
 */
export function validateAndFormatPhone(
  phone: string | null | undefined,
  defaultCountry: string = 'US'
): PhoneValidationResult {
  if (!phone || typeof phone !== 'string' || phone.trim().length < 5) {
    return { valid: false, error: 'Phone number is too short or invalid type' };
  }

  // Sanitize: ensure + prefix
  const sanitizedPhone = phone.trim().startsWith('+') 
    ? phone.trim() 
    : `+1${phone.trim().replace(/\D/g, '')}`;

  try {
    // Attempt robust parsing
    if (!isValidPhoneNumber(sanitizedPhone)) {
      return { valid: false, error: 'Invalid phone number format' };
    }

    const parsed = parsePhoneNumber(sanitizedPhone);
    
    if (!parsed || !parsed.isValid()) {
      return { valid: false, error: 'Invalid phone number' };
    }

    return {
      valid: true,
      formatted: parsed.format('E.164'),
      country: parsed.country,
    };
  } catch (error) {
    // If library fails, fallback to basic E.164-like validation
    console.warn('Phone validation library error, using fallback:', error);
    if (/^\+[1-9]\d{6,14}$/.test(sanitizedPhone)) {
      return {
        valid: true,
        formatted: sanitizedPhone,
      };
    }
    return { 
      valid: false, 
      error: 'Invalid phone number format'
    };
  }
}

/**
 * Quick check if phone number looks valid
 */
export function isValidPhone(phone: string, defaultCountry: string = 'US'): boolean {
  try {
    return isValidPhoneNumber(phone, defaultCountry as any);
  } catch {
    return false;
  }
}

/**
 * Format phone number for display
 */
export function formatPhoneForDisplay(phone: string, defaultCountry: string = 'US'): string {
  try {
    const parsed = parsePhoneNumber(phone, defaultCountry as any);
    return parsed?.formatNational() || phone;
  } catch {
    return phone;
  }
}

/**
 * Detect if phone number is international
 */
export function isInternationalPhone(phone: string, defaultCountry: string = 'US'): boolean {
  try {
    const parsed = parsePhoneNumber(phone, defaultCountry as any);
    return parsed?.country !== defaultCountry;
  } catch {
    return false;
  }
}
