/**
 * @deprecated Supabase has been removed. Use Prisma via @/lib/db instead.
 */
export const supabase = null;

export function createClient() {
  console.warn('Supabase client has been removed. Use Prisma via @/lib/db instead.');
  return null;
}
