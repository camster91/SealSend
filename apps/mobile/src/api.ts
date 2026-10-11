import type { Session } from './model';
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export function apiOrigin(value: string, development: boolean): string {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (!development && url.origin !== 'https://sealsend.app') || (url.protocol !== 'https:' && !(development && local && url.protocol === 'http:'))) throw new Error('Invalid SealSend API origin');
  return url.origin;
}
export class Api {
  session: Session | null = null;
  constructor(public origin: string, private fetcher: typeof fetch = fetch) {}
  async request<T>(path: string, method = 'GET', body?: unknown, mutationKey?: string): Promise<T> {
    if (!/^[a-z0-9/-]+$/.test(path) || path.includes('..')) throw new Error('Invalid API path');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await this.fetcher(`${this.origin}/api/mobile/v1/${path}`, {
        method, credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: this.origin, DNT: '1', ...(mutationKey ? { 'Idempotency-Key': mutationKey } : {}), ...(this.session ? { Authorization: `Bearer ${this.session.sessionToken}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await result.json().catch(() => null);
      if (!result.ok) throw new ApiError(data?.error || 'Please try again.', result.status);
      if (!data) throw new ApiError('The server returned an unexpected response.', 502);
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Could not connect. Check your connection and try again. Nothing was confirmed.', 0);
    } finally { clearTimeout(timeout); }
  }
}
