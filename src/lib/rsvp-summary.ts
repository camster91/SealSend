export type SummaryResponse = { id: string; status: string; headcount: number; response_data: Record<string, unknown> | null };
export type SummaryField = { field_name: string; field_label: string; field_type: string; is_required: boolean };

export function buildRsvpSummary(responses: SummaryResponse[], fields: SummaryField[], maxAttendees: number | null) {
  const statusCounts = { attending: 0, not_attending: 0, maybe: 0, pending: 0 };
  let attendingHeadcount = 0;
  for (const response of responses) {
    if (response.status in statusCounts) statusCounts[response.status as keyof typeof statusCounts]++;
    if (response.status === "attending") attendingHeadcount += Math.max(0, Number(response.headcount) || 0);
  }
  const fieldSummaries = fields.map((field) => {
    let answered = 0;
    const counts = new Map<string, number>();
    for (const response of responses) {
      const value = response.response_data?.[field.field_name];
      const values = Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value];
      if (values.length) answered++;
      if (["select", "multiselect", "number"].includes(field.field_type)) {
        for (const item of values) {
          const normalized = String(item).trim().slice(0, 100);
          if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        }
      }
    }
    return {
      fieldName: field.field_name,
      label: field.field_label,
      type: field.field_type,
      required: field.is_required,
      answered,
      incomplete: responses.length - answered,
      counts: [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    };
  });
  return {
    sourceResponseCount: responses.length,
    sourceResponseIds: responses.map((response) => response.id),
    statusCounts,
    attendingHeadcount,
    capacity: maxAttendees === null ? null : { maximum: maxAttendees, remaining: Math.max(0, maxAttendees - attendingHeadcount), utilizationPercent: Math.round((attendingHeadcount / maxAttendees) * 100) },
    fields: fieldSummaries,
  };
}
