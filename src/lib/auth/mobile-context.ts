import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthUser } from './types';

// Only the allow-listed mobile gateway establishes this server-side context.
// Incoming headers cannot create or change an identity.
type MobileContext = { user: AuthUser | null; sessionToken: string | null };
const context = new AsyncLocalStorage<MobileContext>();
export const getMobileContext = () => context.getStore();
export function withMobileContext<T>(value: MobileContext, action: () => T): T {
  return context.run(value, action);
}
