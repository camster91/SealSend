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
  phone: string,
  defaultCountry: string = 'US'
): PhoneValidationResult {
  try {
    // Basic pre-check
    if (!phone || phone.trim().length < 10) {
      return { valid: false, error: 'Phone number is too short' };
    }

    // Check if valid for the country
    if (!isValidPhoneNumber(phone, defaultCountry as any)) {
      return { valid: false, error: 'Invalid phone number format' };
    }

    const parsed = parsePhoneNumber(phone, defaultCountry as any);
    
    if (!parsed || !parsed.isValid()) {
      return { valid: false, error: 'Invalid phone number' };
    }

    // Return E.164 format (required by Twilio)
    return {
      valid: true,
      formatted: parsed.format('E.164'),
      country: parsed.country,
    };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid phone number format'
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
