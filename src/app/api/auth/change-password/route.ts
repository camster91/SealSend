import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db/client';
import { requireApiHost } from '@/lib/auth/api-auth';
import { verifyPassword, hashPassword, checkPasswordStrength } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiHost();
    if (auth.error) return auth.error;
    const user = auth.user;

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Check password strength
    const strength = checkPasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json(
        { error: 'Password too weak', feedback: strength.feedback },
        { status: 400 }
      );
    }

    // Get the admin user's current password hash
    const adminUser = await queryOne<{ id: string; password: string }>(
      'SELECT id, password FROM admin_users WHERE id = $1',
      [user.id]
    );

    if (!adminUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, adminUser.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash and save new password
    const hashedPassword = await hashPassword(newPassword);
    await query(
      'UPDATE admin_users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
