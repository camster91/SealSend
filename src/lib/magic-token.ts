import { createHash, randomBytes } from 'node:crypto';

export function generateMagicToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashMagicToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function previewMagicToken(token: string): string {
  return token.slice(-4);
}

export function isValidMagicToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
