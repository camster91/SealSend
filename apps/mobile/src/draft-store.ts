export type DraftBody = { title: string; description: string; location_name: string; event_date: string; event_timezone: string; status: 'draft' };
export type PendingDraft = { key: string; hostId: string; body: DraftBody };
/** Never surface recovery details from another account, including stale memory. */
export function draftForHost(draft: PendingDraft | null, hostId: string | null | undefined): PendingDraft | null {
  return hostId && draft?.hostId === hostId ? draft : null;
}
export type PrivateStore = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; remove: (key: string) => Promise<void> };
const manifest = 'sealsend-pending-draft-v1';
const part = (index: number) => `${manifest}-${index}`;
export class DraftStore {
  constructor(private storage: PrivateStore, private newKey: () => string) {}
  async read(): Promise<PendingDraft | null> {
    const raw = await this.storage.get(manifest);
    if (!raw) return null;
    const meta = JSON.parse(raw);
    if (!Number.isInteger(meta.parts) || meta.parts < 1 || meta.parts > 32 || !/^[0-9a-f-]{36}$/i.test(meta.key) || typeof meta.hostId !== 'string') throw new Error('Unable to recover the pending draft. Get support before retrying.');
    let body = '';
    for (let i = 0; i < meta.parts; i++) {
      const value = await this.storage.get(part(i));
      if (value === null) throw new Error('The pending draft is incomplete. Get support before retrying.');
      body += value;
    }
    const parsed = JSON.parse(body);
    if (typeof parsed.title !== 'string' || typeof parsed.description !== 'string' || typeof parsed.location_name !== 'string' || typeof parsed.event_timezone !== 'string' || !Number.isFinite(Date.parse(parsed.event_date)) || parsed.status !== 'draft') throw new Error('Unable to recover draft details.');
    return { key: meta.key, hostId: meta.hostId, body: parsed };
  }
  async prepare(hostId: string, body: DraftBody): Promise<PendingDraft> {
    const previous = await this.read();
    if (previous) {
      if (previous.hostId !== hostId || JSON.stringify(previous.body) !== JSON.stringify(body)) throw new Error('An unconfirmed draft is waiting. Retry the original draft before changing its details.');
      return previous;
    }
    // Each Keychain/Keystore item stays below historical 2KB size limits.
    const chars = Array.from(JSON.stringify(body));
    const parts = Math.ceil(chars.length / 400);
    if (parts > 32) throw new Error('This draft is too large to save securely. Shorten the description.');
    const key = this.newKey();
    for (let i = 0; i < parts; i++) await this.storage.set(part(i), chars.slice(i * 400, (i + 1) * 400).join(''));
    // Commit metadata before the request is sent. Partial local writes cannot
    // correspond to a server mutation; callers await this method before POST.
    await this.storage.set(manifest, JSON.stringify({ key, hostId, parts }));
    return { key, hostId, body };
  }
  async clear() {
    // Attempt every deletion even if one item is unavailable. Never parse a
    // possibly corrupt manifest while removing private recovery data.
    const results = await Promise.allSettled([
      Promise.resolve().then(() => this.storage.remove(manifest)),
      ...Array.from({ length: 32 }, (_, i) => Promise.resolve().then(() => this.storage.remove(part(i)))),
    ]);
    if (results.some(result => result.status === 'rejected')) throw new Error('Device recovery data could not be fully cleared. Unlock your device and retry.');
  }
}
/** Recovery storage failure must not prevent authenticated event access. */
export async function readHostRecovery(read: () => Promise<PendingDraft | null>, hostId: string) {
  try {
    const saved = await read();
    const draft = draftForHost(saved, hostId);
    return { draft, unavailable: Boolean(saved && !draft) };
  }
  catch { return { draft: null, unavailable: true }; }
}
