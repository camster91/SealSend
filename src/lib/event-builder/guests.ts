export interface BulkResult {
  /** How many guests the server saved. */
  added: number;
  /** A plain-words note, such as guests skipped as duplicates. */
  notice?: string;
  /** A plain-words error. Set when nothing could be saved. */
  error?: string;
}

const GENERIC = "Something went wrong, so no guests were added. Please try again.";
const INVALID = "Check the names and emails, then try again.";

const count = (n: number) => `${n} ${n === 1 ? "guest" : "guests"}`;

export function guestsAddedLabel(n: number): string {
  return `${count(n)} added`;
}

/** Turns the bulk-add response into words a host can read. Never returns raw codes. */
export function describeBulkResult(status: number, body: unknown): BulkResult {
  const json = (body && typeof body === "object" ? body : {}) as {
    inserted?: number;
    skipped?: number;
    error?: string;
  };
  if (status >= 200 && status < 300) {
    const added = typeof json.inserted === "number" ? json.inserted : 0;
    const skipped = typeof json.skipped === "number" ? json.skipped : 0;
    const notice =
      skipped > 0
        ? `${count(skipped)} ${skipped === 1 ? "was" : "were"} already on your list, so ${skipped === 1 ? "it was" : "they were"} skipped.`
        : undefined;
    return { added, notice };
  }
  if (status === 403 && typeof json.error === "string" && /limit/i.test(json.error)) {
    return { added: 0, error: json.error };
  }
  if (status === 400) return { added: 0, error: INVALID };
  return { added: 0, error: GENERIC };
}
