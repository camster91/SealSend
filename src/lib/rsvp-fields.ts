import type { RSVPField } from '@/types/database';

type SemanticField = { field_name: string; field_type: string; options?: string[] | null };
export function rsvpFieldRole(field: SemanticField): 'name' | 'email' | 'headcount' | 'attendance' | 'custom' {
  if (field.field_type === 'attendance' || (field.field_name === 'attending' && field.field_type === 'select'
    && field.options?.length === 2 && field.options.includes('Joyfully Accepts') && field.options.includes('Regretfully Declines'))) return 'attendance';
  if (field.field_type === 'text' && ['name', 'respondent_name'].includes(field.field_name)) return 'name';
  if (field.field_type === 'number' && ['guests', 'headcount'].includes(field.field_name)) return 'headcount';
  if (field.field_type === 'email' && field.field_name === 'email') return 'email';
  return 'custom';
}

/** Interpret only the reserved default questions, never arbitrary custom selects. */
export function normalizeRsvpFields(fields: RSVPField[]): RSVPField[] {
  return fields.map((field) => {
    const role = rsvpFieldRole(field);
    if (role === 'name') {
      return { ...field, field_name: 'respondent_name' };
    }
    if (role === 'headcount') {
      return { ...field, field_name: 'headcount' };
    }
    if (role === 'attendance') {
      return { ...field, field_type: 'attendance' };
    }
    return field;
  });
}

export type RsvpResponseValue = string | string[];

/**
 * Keep legacy scalar answers and new array answers readable everywhere a
 * response is displayed or exported. Custom fields are stored as JSON, so a
 * number or boolean from an older client is also rendered without producing
 * `[object Object]` or silently disappearing.
 */
export function rsvpResponseValues(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  return rawValues
    .map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'number' || typeof item === 'boolean') return String(item);
      if (item && typeof item === 'object') {
        try { return JSON.stringify(item); } catch { return ''; }
      }
      return '';
    })
    .filter((item) => item.trim() !== '');
}

export function serializeRsvpResponseValue(value: unknown): string {
  return rsvpResponseValues(value).join('; ');
}

/**
 * Validate custom answers against the fields currently configured for an event.
 * Reserved defaults are submitted through the top-level RSVP payload, while
 * unknown response keys remain valid so historical answers survive field edits.
 */
export function validateRsvpResponseData(
  fields: RSVPField[],
  responseData: Record<string, unknown>,
  priorResponseData: Record<string, unknown> = {},
): { valid: true } | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const field of normalizeRsvpFields(fields).filter((candidate) => candidate.is_enabled)) {
    const role = rsvpFieldRole(field);
    if (role !== 'custom') continue;

    const value = responseData[field.field_name];
    const isMissing = value === undefined || value === null
      || (typeof value === 'string' && value.trim() === '')
      || (Array.isArray(value) && value.length === 0);
    if (isMissing) {
      if (field.is_required) errors[field.field_name] = `${field.field_label} is required.`;
      continue;
    }

    if (field.field_type === 'multiselect') {
      // Accept a scalar from older responses as one selected option. New
      // submissions always send arrays, but historical rows are not migrated.
      const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : null;
      if (!values || !values.every((option): option is string => typeof option === 'string')) {
        errors[field.field_name] = `${field.field_label} must contain one or more valid options.`;
        continue;
      }
      const currentOptions = field.options ?? [];
      // Hosts can remove or rename a choice after a guest has answered. An
      // authorized edit may retain that historical choice, but new choices
      // must still be configured on the current field.
      const priorOptions = rsvpResponseValues(priorResponseData[field.field_name]);
      if (!currentOptions.length && !priorOptions.length) {
        errors[field.field_name] = `${field.field_label} has no configured options.`;
        continue;
      }
      if (values.some((option) => !currentOptions.includes(option) && !priorOptions.includes(option))) {
        errors[field.field_name] = `${field.field_label} contains an invalid option.`;
      }
      continue;
    }

    if (field.field_type === 'number') {
      const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (!Number.isFinite(numericValue)) {
        errors[field.field_name] = `${field.field_label} must be a number.`;
      }
      continue;
    }

    // Keep scalar values accepted by older clients readable on edit. Current
    // browser submissions use strings, while legacy JSON may contain a
    // boolean or number for a text-like custom field.
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      errors[field.field_name] = `${field.field_label} must be a scalar value.`;
      continue;
    }

    const priorOptions = rsvpResponseValues(priorResponseData[field.field_name]);
    if (field.field_type === 'select'
      && (typeof value !== 'string' || (!field.options?.includes(value) && !priorOptions.includes(value)))) {
      errors[field.field_name] = `${field.field_label} contains an invalid option.`;
    }
  }
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}
