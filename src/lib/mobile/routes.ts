export type MobileOperation = 'sendCode' | 'verifyCode' | 'passwordLogin' | 'me' | 'logout' | 'events' | 'createEvent' | 'event' | 'updateEvent' | 'checkInList' | 'checkIn' | 'walkIn' | 'deletionStatus' | 'requestDeletion' | 'cancelDeletion';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function mobileOperation(method: string, path: string[]): { operation: MobileOperation; eventId?: string } | null {
  const key = `${method} ${path.join('/')}`;
  const exact: Record<string, MobileOperation> = {
    'POST auth/code': 'sendCode', 'POST auth/verify': 'verifyCode', 'POST auth/password': 'passwordLogin',
    'GET me': 'me', 'DELETE session': 'logout',
    'GET events': 'events', 'POST events': 'createEvent',
    'GET account/deletion': 'deletionStatus', 'POST account/deletion': 'requestDeletion', 'DELETE account/deletion': 'cancelDeletion',
  };
  if (exact[key]) return { operation: exact[key] };
  if (path[0] !== 'events' || !uuid.test(path[1] ?? '')) return null;
  const eventId = path[1];
  if (path.length === 2 && method === 'GET') return { operation: 'event', eventId };
  if (path.length === 2 && method === 'PATCH') return { operation: 'updateEvent', eventId };
  if (path.length === 3 && path[2] === 'check-in') {
    if (method === 'GET') return { operation: 'checkInList', eventId };
    if (method === 'PATCH') return { operation: 'checkIn', eventId };
    if (method === 'POST') return { operation: 'walkIn', eventId };
  }
  return null;
}
export function mobileBearer(value: string | null): string | null {
  const match = value?.match(/^Bearer ([0-9a-f-]{36})$/i);
  return match && uuid.test(match[1]) ? match[1] : null;
}
