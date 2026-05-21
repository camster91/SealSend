'use server';

import { prisma } from '@/lib/db';
import { UnauthorizedError, ValidationError, AppError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { sendEmail } from '@/lib/email';

export async function loginWithPassword(email: string, password: string) {
  // This action is now handled by /api/auth/login and /api/auth/login-password API routes.
  // Kept as a server action stub for backward compatibility.
  throw new AppError('Please use the login form which calls /api/auth/login-password directly.');
}

export async function verifyOtp(email: string, token: string) {
  // This action is now handled by /api/auth/verify-code API route.
  // Kept as a server action stub for backward compatibility.
  throw new AppError('Please use the login form which calls /api/auth/verify-code directly.');
}

export async function sendOtp(email: string) {
  // This action is now handled by /api/auth/send-code API route.
  // Kept as a server action stub for backward compatibility.
  throw new AppError('Please use the login form which calls /api/auth/send-code directly.');
}
