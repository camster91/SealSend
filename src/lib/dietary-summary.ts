type Reply = {
  status: string;
  response_data: Record<string, unknown> | null;
  plus_ones_data?: Array<{ answers?: Record<string, unknown> | null }> | null;
};

function recordNote(notes: Map<string, { note: string; count: number }>, value: unknown) {
  if (typeof value !== "string" || !value.trim()) return;
  const note = value.trim();
  const entry = notes.get(note.toLowerCase());
  if (entry) entry.count += 1;
  else notes.set(note.toLowerCase(), { note, count: 1 });
}

/** Guests' dietary notes in their own words: shortening them could hide an allergy. */
export function summarizeDietary(replies: Reply[]): { note: string; count: number }[] {
  const notes = new Map<string, { note: string; count: number }>();
  for (const reply of replies) {
    if (reply.status === "not_attending") continue;
    recordNote(notes, reply.response_data?.dietary_restrictions || reply.response_data?.dietary);
    if (Array.isArray(reply.plus_ones_data)) {
      for (const plusOne of reply.plus_ones_data) {
        recordNote(notes, plusOne?.answers?.dietary_restrictions || plusOne?.answers?.dietary);
      }
    }
  }
  return [...notes.values()].sort((a, b) => b.count - a.count || a.note.localeCompare(b.note));
}
