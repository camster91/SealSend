/**
 * @deprecated Supabase has been removed. Use Prisma via @/lib/db instead.
 */
export const supabase = null;

export async function createClient() {
  console.warn('Supabase server client has been removed. Use Prisma via @/lib/db instead.');
  return null;
}
