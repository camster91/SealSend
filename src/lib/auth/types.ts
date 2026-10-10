import type { MarketingChannel } from "@/lib/analytics/marketing-attribution";
export type UserRole = 'admin' | 'guest';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  name?: string;
  eventId?: string; // For guests, which event they belong to
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: Date;
}

export type AuthMethod = 'email' | 'phone' | 'password';

export interface LoginRequest {
  method: AuthMethod;
  email?: string;
  phone?: string;
  password?: string;
  eventId?: string; // For guest login
}

export interface VerifyRequest {
  channel?: MarketingChannel;
  method: AuthMethod;
  email?: string;
  phone?: string;
  code: string;
  eventId?: string;
}