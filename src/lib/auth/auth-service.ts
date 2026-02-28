import { createClient } from '@/lib/supabase/client';
import { LoginRequest, VerifyRequest, AuthUser, UserRole } from './types';

export class AuthService {
  private supabase = createClient();

  async sendLoginCode(request: LoginRequest): Promise<{ success: boolean; message: string }> {
    try {
      if (request.method === 'email' && request.email) {
        return await this.sendEmailCode(request.email, request.eventId);
      } else if (request.method === 'phone' && request.phone) {
        return await this.sendSMSCode(request.phone, request.eventId);
      } else if (request.method === 'password' && request.email && request.password) {
        return await this.verifyPassword(request.email, request.password);
      }
      return { success: false, message: 'Invalid request' };
    } catch (error) {
      console.error('Auth error:', error);
      return { success: false, message: 'Authentication failed' };
    }
  }

  async verifyCode(request: VerifyRequest): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    try {
      if (request.method === 'email' && request.email) {
        return await this.verifyEmailCode(request.email, request.code, request.eventId);
      } else if (request.method === 'phone' && request.phone) {
        return await this.verifySMSCode(request.phone, request.code, request.eventId);
      }
      return { success: false, message: 'Invalid verification request' };
    } catch (error) {
      console.error('Verification error:', error);
      return { success: false, message: 'Verification failed' };
    }
  }

  private async sendEmailCode(email: string, eventId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'email', email, eventId })
      });

      if (!response.ok && response.headers.get('content-type')?.includes('text/html')) {
        return { success: false, message: 'Server configuration error. Please try again later.' };
      }

      const result = await response.json();
      return result.success
        ? { success: true, message: result.message }
        : { success: false, message: result.error || 'Failed to send code' };
    } catch (error) {
      console.error('Send email code error:', error);
      return { success: false, message: 'Unable to connect to the server. Please check your connection and try again.' };
    }
  }

  private async sendSMSCode(phone: string, eventId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'phone', phone, eventId })
      });

      if (!response.ok && response.headers.get('content-type')?.includes('text/html')) {
        return { success: false, message: 'Server configuration error. Please try again later.' };
      }

      const result = await response.json();
      return result.success
        ? { success: true, message: result.message }
        : { success: false, message: result.error || 'Failed to send code' };
    } catch (error) {
      console.error('Send SMS code error:', error);
      return { success: false, message: 'Unable to connect to the server. Please check your connection and try again.' };
    }
  }

  private async verifyPassword(email: string, password: string): Promise<{ success: boolean; message: string }> {
    // For now, we'll use the API route approach
    // In a real implementation, this would be a separate API endpoint
    return { success: false, message: 'Password login not implemented yet' };
  }

  private async verifyEmailCode(email: string, code: string, eventId?: string):
    Promise<{ success: boolean; user?: AuthUser; message: string }> {

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'email', email, code, eventId })
      });

      if (!response.ok && response.headers.get('content-type')?.includes('text/html')) {
        return { success: false, message: 'Server configuration error. Please try again later.' };
      }

      const result = await response.json();

      if (result.success && result.user) {
        const user: AuthUser = {
          id: result.user.id,
          email: result.user.email,
          phone: result.user.phone,
          role: result.user.role,
          eventId: result.user.eventId
        };

        // Store in localStorage for client-side access
        if (typeof window !== 'undefined') {
          localStorage.setItem('sealsend_user', JSON.stringify(user));
        }

        return { success: true, user, message: result.message };
      } else {
        return { success: false, message: result.error || 'Verification failed' };
      }
    } catch (error) {
      console.error('Verify email code error:', error);
      return { success: false, message: 'Unable to connect to the server. Please check your connection and try again.' };
    }
  }

  private async verifySMSCode(phone: string, code: string, eventId?: string):
    Promise<{ success: boolean; user?: AuthUser; message: string }> {

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'phone', phone, code, eventId })
      });

      if (!response.ok && response.headers.get('content-type')?.includes('text/html')) {
        return { success: false, message: 'Server configuration error. Please try again later.' };
      }

      const result = await response.json();

      if (result.success && result.user) {
        const user: AuthUser = {
          id: result.user.id,
          email: result.user.email,
          phone: result.user.phone,
          role: result.user.role,
          eventId: result.user.eventId
        };

        // Store in localStorage for client-side access
        if (typeof window !== 'undefined') {
          localStorage.setItem('sealsend_user', JSON.stringify(user));
        }

        return { success: true, user, message: result.message };
      } else {
        return { success: false, message: result.error || 'Verification failed' };
      }
    } catch (error) {
      console.error('Verify SMS code error:', error);
      return { success: false, message: 'Unable to connect to the server. Please check your connection and try again.' };
    }
  }

  private async isAdminEmail(email: string): Promise<boolean> {
    // This will be determined by the API
    return false;
  }
}