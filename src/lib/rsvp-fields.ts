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
