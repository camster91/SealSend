export type GuestCsvEntry = {
  name: string;
  email: string;
};

export type GuestCsvIssue = {
  row: number;
  message: string;
};

export type NormalizedGuestImport = {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type ExistingGuestContact = {
  email: string | null;
  phone?: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsvRows(input: string): Array<{ row: number; cells: string[] }> {
  const source = input.replace(/^\uFEFF/, "");
  const rows: Array<{ row: number; cells: string[] }> = [];
  let cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let physicalRow = 1;
  let rowStartedAt = 1;

  const finishRow = () => {
    cells.push(current.trim());
    if (cells.some((cell) => cell.length > 0)) rows.push({ row: rowStartedAt, cells });
    cells = [];
    current = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (inQuotes && source[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      finishRow();
      physicalRow += 1;
      rowStartedAt = physicalRow;
    } else {
      current += character;
      if (character === "\n") physicalRow += 1;
    }
  }

  if (current.length > 0 || cells.length > 0) finishRow();
  return rows;
}

function isHeader(cells: string[]): boolean {
  const first = cells[0]?.trim().toLowerCase();
  const second = cells[1]?.trim().toLowerCase();
  return (first === "name" || first === "guest name") && second === "email";
}

export function parseGuestCsv(
  input: string,
  existingGuests: GuestCsvEntry[] = [],
): { guests: GuestCsvEntry[]; issues: GuestCsvIssue[] } {
  const rows = parseCsvRows(input);
  const guests: GuestCsvEntry[] = [];
  const issues: GuestCsvIssue[] = [];
  const existingEmails = new Set(
    existingGuests.map((guest) => guest.email.trim().toLowerCase()).filter(Boolean),
  );
  const importedEmails = new Set<string>();

  for (const [index, row] of rows.entries()) {
    if (index === 0 && isHeader(row.cells)) continue;
    const name = row.cells[0]?.trim() ?? "";
    const email = row.cells[1]?.trim().toLowerCase() ?? "";

    if (!name) {
      issues.push({ row: row.row, message: "Guest name is required." });
      continue;
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      issues.push({ row: row.row, message: "Enter a valid email address or leave it blank." });
      continue;
    }
    if (email && existingEmails.has(email)) {
      issues.push({ row: row.row, message: `Email ${email} is already on the guest list.` });
      continue;
    }
    if (email && importedEmails.has(email)) {
      issues.push({ row: row.row, message: `Email ${email} is repeated in this import.` });
      continue;
    }

    guests.push({ name, email });
    if (email) importedEmails.add(email);
  }

  return { guests, issues };
}

export function deduplicateGuestImport(
  candidates: NormalizedGuestImport[],
  existingContacts: ExistingGuestContact[],
): {
  accepted: NormalizedGuestImport[];
  duplicates: Array<{ name: string; reason: string }>;
} {
  const seenEmails = new Set(
    existingContacts.map((guest) => guest.email?.trim().toLowerCase()).filter((value): value is string => Boolean(value)),
  );
  const seenPhones = new Set(
    existingContacts.map((guest) => guest.phone?.trim()).filter((value): value is string => Boolean(value)),
  );
  const accepted: NormalizedGuestImport[] = [];
  const duplicates: Array<{ name: string; reason: string }> = [];

  for (const guest of candidates) {
    const emailKey = guest.email?.trim().toLowerCase() || null;
    const phoneKey = guest.phone?.trim() || null;
    if (emailKey && seenEmails.has(emailKey)) {
      duplicates.push({ name: guest.name, reason: `Email ${guest.email} is already on this guest list` });
      continue;
    }
    if (phoneKey && seenPhones.has(phoneKey)) {
      duplicates.push({ name: guest.name, reason: `Phone ${guest.phone} is already on this guest list` });
      continue;
    }

    accepted.push(guest);
    if (emailKey) seenEmails.add(emailKey);
    if (phoneKey) seenPhones.add(phoneKey);
  }

  return { accepted, duplicates };
}
