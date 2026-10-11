export type DraftBody = { title: string; description: string; location_name: string; event_date: string; event_timezone: string; status: 'draft' };
export type PendingDraft = { key: string; hostId: string; body: DraftBody };
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
    await this.storage.remove(manifest);
    // Also erase uncommitted fragments after a partially failed local write.
    for (let i = 0; i < 32; i++) await this.storage.remove(part(i));
  }
}
