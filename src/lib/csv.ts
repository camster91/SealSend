/**
 * Quotes one CSV cell and neutralises spreadsheet formulas: a cell starting
 * with =, +, -, @, tab or carriage return is prefixed with an apostrophe.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
