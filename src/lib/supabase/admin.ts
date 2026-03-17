/**
 * @deprecated Supabase has been removed. Use Prisma via @/lib/db instead.
 */
export const supabase = null;

export function createAdminClient() {
  console.warn('Supabase admin client has been removed. Use Prisma via @/lib/db instead.');
  return null;
}
