type Reply = { status: string; response_data: Record<string, unknown> | null };

/** Guests' dietary notes in their own words: shortening them could hide an allergy. */
export function summarizeDietary(replies: Reply[]): { note: string; count: number }[] {
  const notes = new Map<string, { note: string; count: number }>();
  for (const reply of replies) {
    if (reply.status === "not_attending") continue;
    const value = reply.response_data?.dietary_restrictions || reply.response_data?.dietary;
    if (typeof value !== "string" || !value.trim()) continue;
    const note = value.trim();
    const entry = notes.get(note.toLowerCase());
    if (entry) entry.count += 1;
    else notes.set(note.toLowerCase(), { note, count: 1 });
  }
  return [...notes.values()].sort((a, b) => b.count - a.count || a.note.localeCompare(b.note));
}
