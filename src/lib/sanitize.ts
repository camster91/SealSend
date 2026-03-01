/**
 * Input sanitization utilities for security
 */

import { isValidHexColor } from './utils';

// Allowed font families
const ALLOWED_FONTS = [
  'Inter',
  'Poppins',
  'Georgia',
  'Times New Roman',
  'Arial',
  'Helvetica',
  'serif',
  'sans-serif',
  'monospace',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
];

// Allowed button styles
const ALLOWED_BUTTON_STYLES = ['rounded', 'pill', 'square'] as const;

// Maximum lengths for string fields
const MAX_LENGTHS = {
  title: 200,
  description: 2000,
  locationName: 200,
  locationAddress: 500,
  hostName: 200,
  dressCode: 100,
  fontFamily: 50,
};

/**
 * Sanitize a URL to prevent XSS and ensure it's safe
 */
export function sanitizeUrl(url: string | null | undefined, allowedProtocols: string[] = ['https:']): string | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    
    // Check protocol
    if (!allowedProtocols.includes(parsed.protocol)) {
      return null;
    }
    
    // Check for common XSS patterns in the URL
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerous.some(d => parsed.protocol.toLowerCase().startsWith(d))) {
      return null;
    }
    
    // Only allow https URLs for images and external links
    if (parsed.protocol !== 'https:') {
      return null;
    }
    
    return url;
  } catch {
    return null;
  }
}

/**
 * Sanitize a CSS color value
 */
export function sanitizeColor(color: string | null | undefined, defaultColor: string = '#7c3aed'): string {
  if (!color || !isValidHexColor(color)) {
    return defaultColor;
  }
  return color;
}

/**
 * Sanitize font family
 */
export function sanitizeFontFamily(font: string | null | undefined): string {
  if (!font) return 'Inter';
  
  // Check exact match first
  if (ALLOWED_FONTS.includes(font)) {
    return font;
  }
  
  // Check if it contains any dangerous characters
  if (/[<>{}]/.test(font)) {
    return 'Inter';
  }
  
  // Return the font if it looks reasonable, otherwise fallback
  return font.length < MAX_LENGTHS.fontFamily ? font : 'Inter';
}

/**
 * Sanitize button style
 */
export function sanitizeButtonStyle(style: string | null | undefined): 'rounded' | 'pill' | 'square' {
  if (style && ALLOWED_BUTTON_STYLES.includes(style as any)) {
    return style as 'rounded' | 'pill' | 'square';
  }
  return 'rounded';
}

/**
 * Sanitize background image URL
 */
export function sanitizeBackgroundImage(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Must be HTTPS
  if (!url.startsWith('https://')) {
    return null;
  }
  
  // Check for suspicious patterns
  const suspicious = ['"', "'", '<', '>', '{', '}', ';', '\\'];
  if (suspicious.some(char => url.includes(char))) {
    return null;
  }
  
  // Validate URL structure
  try {
    const parsed = new URL(url);
    // Only allow common image extensions
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (!allowedExts.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) {
      // Not a dealbreaker, but log it
      console.warn('[Sanitize] Background image may not be an image:', url);
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Sanitize audio URL
 */
export function sanitizeAudioUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  if (!url.startsWith('https://')) {
    return null;
  }
  
  // Check for suspicious patterns
  const suspicious = ['"', "'", '<', '>', '{', '}', ';', '\\'];
  if (suspicious.some(char => url.includes(char))) {
    return null;
  }
  
  return url;
}

/**
 * Sanitize text content to prevent XSS
 */
export function sanitizeText(text: string | null | undefined, maxLength: number = 1000): string {
  if (!text) return '';
  
  // Trim and limit length
  let sanitized = text.trim().slice(0, maxLength);
  
  // Basic XSS prevention - remove script tags and event handlers
  sanitized = sanitized
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '');
  
  return sanitized;
}

/**
 * Sanitize event customization object
 */
export function sanitizeCustomization(customization: Record<string, unknown> | null | undefined) {
  if (!customization || typeof customization !== 'object') {
    return {
      primaryColor: '#7c3aed',
      backgroundColor: '#ffffff',
      backgroundImage: null,
      fontFamily: 'Inter',
      buttonStyle: 'rounded' as const,
      showCountdown: true,
      audioUrl: null,
      logoUrl: null,
    };
  }

  return {
    primaryColor: sanitizeColor(customization.primaryColor as string, '#7c3aed'),
    backgroundColor: sanitizeColor(customization.backgroundColor as string, '#ffffff'),
    backgroundImage: sanitizeBackgroundImage(customization.backgroundImage as string),
    fontFamily: sanitizeFontFamily(customization.fontFamily as string),
    buttonStyle: sanitizeButtonStyle(customization.buttonStyle as string),
    showCountdown: Boolean(customization.showCountdown),
    audioUrl: sanitizeAudioUrl(customization.audioUrl as string),
    logoUrl: sanitizeUrl(customization.logoUrl as string),
  };
}

/**
 * Sanitize invite token
 */
export function sanitizeInviteToken(token: string | null | undefined): string | null {
  if (!token) return null;
  
  // Tokens are base64url encoded, so they should only contain alphanumeric chars, -, and _
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    return null;
  }
  
  return token.slice(0, 100); // Limit length
}
