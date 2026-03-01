import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function GuestPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }

  // All users now use the same dashboard
  redirect('/dashboard');
}
