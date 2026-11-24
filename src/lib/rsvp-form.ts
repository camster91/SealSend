import type { PlusOneData, RSVPField } from "@/types/database";

/** Every reply needs a yes or no, asked first, even when the host's questions leave it out. */
export function withAttendanceQuestion(fields: RSVPField[]): RSVPField[] {
  const existing = fields.find((field) => field.field_type === "attendance");
  const attendance = existing
    ? { ...existing, sort_order: -1, ...(existing.is_enabled ? {} : { is_enabled: true, is_required: true }) }
    : ({
        id: "attendance", field_name: "attendance", field_type: "attendance", field_label: "Will you be there?",
        is_required: true, is_enabled: true, sort_order: -1, options: null, placeholder: null,
      } as unknown as RSVPField);
  return [attendance, ...fields.filter((field) => field !== existing)];
}

const PARTY_FIELDS = new Set(["headcount", "plus_one"]);

/** Questions about the visit are hidden from guests who can't come, unless the host requires them. */
export function showsField(field: RSVPField, status: string): boolean {
  if (status !== "not_attending") return true;
  if (PARTY_FIELDS.has(field.field_name)) return false;
  return field.is_required || !/^dietary/.test(field.field_name);
}

export function rsvpSubmission(status: string, headcount: number, plusOnes: PlusOneData[]): { headcount: number; plus_ones: PlusOneData[] } {
  if (status === "not_attending") return { headcount: 1, plus_ones: [] };
  return { headcount, plus_ones: plusOnes.filter((guest) => guest.name.trim() !== "") };
}
