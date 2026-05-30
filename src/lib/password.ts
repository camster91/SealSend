/**
 * Password hashing and verification utilities
 * Uses bcryptjs for secure password handling
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 14;

/**
 * Hash a password for secure storage
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowers = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specials = '!@#$%^&*';
  
  const passwordArr: string[] = [];
  
  // Ensure at least one of each required character type using secure randomness
  passwordArr.push(uppers[crypto.randomInt(0, uppers.length)]);
  passwordArr.push(lowers[crypto.randomInt(0, lowers.length)]);
  passwordArr.push(numbers[crypto.randomInt(0, numbers.length)]);
  passwordArr.push(specials[crypto.randomInt(0, specials.length)]);

  // Fill the rest randomly using secure randomness
  for (let i = 4; i < length; i++) {
    passwordArr.push(charset[crypto.randomInt(0, charset.length)]);
  }

  // Shuffle the password using a cryptographically secure Fisher-Yates shuffle
  for (let i = passwordArr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordArr[i], passwordArr[j]] = [passwordArr[j], passwordArr[i]];
  }
  
  return passwordArr.join('');
}

/**
 * Check if a password meets minimum strength requirements
 */
export function checkPasswordStrength(password: string): {
  valid: boolean;
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score++;
  else feedback.push('Password must be at least 8 characters');

  if (password.length >= 12) score++;

  // Complexity checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (hasUppercase && hasLowercase) score++;
  else feedback.push('Include both uppercase and lowercase letters');

  if (hasNumbers) score++;
  else feedback.push('Include at least one number');

  if (hasSpecial) score++;
  else feedback.push('Include at least one special character');

  // Cap score at 4
  score = Math.min(score, 4);

  return {
    valid: score >= 2 && password.length >= 8,
    score,
    feedback,
  };
}
