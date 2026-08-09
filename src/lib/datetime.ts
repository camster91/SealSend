function localParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function instantToZonedLocalDateTime(value: string | Date, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid event date");
  return localParts(date, timeZone);
}

export function zonedLocalDateTimeToInstant(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid local date and time");
  const [, year, month, day, hour, minute] = match;
  const wallClockUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const candidates: number[] = [];
  for (let deltaMinutes = -14 * 60; deltaMinutes <= 14 * 60; deltaMinutes += 15) {
    const candidate = wallClockUtc + deltaMinutes * 60_000;
    if (localParts(new Date(candidate), timeZone) === value) candidates.push(candidate);
  }
  if (candidates.length === 0) throw new Error("This local time does not exist in the selected timezone due to a daylight-saving change.");
  return new Date(Math.min(...candidates)).toISOString();
}
