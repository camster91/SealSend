import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRsvpFields, rsvpFieldRole } from '../src/lib/rsvp-fields';
import { DEFAULT_RSVP_FIELDS } from '../src/lib/constants';
import type { RSVPField } from '../src/types/database';
const fields = (values: Array<{field_name: string; field_type: RSVPField['field_type']; options?: string[]}>) => values.map((value, index) => ({ id: String(index), event_id: 'event', field_label: value.field_name, is_required: true, is_enabled: true, placeholder: null, options: null, sort_order: index, created_at: '', ...value }));
test('default questions use canonical identity, headcount and attendance semantics', () => {
  assert.equal(DEFAULT_RSVP_FIELDS.find(f => f.field_name === 'attending')?.field_type, 'attendance');
  assert.ok(DEFAULT_RSVP_FIELDS.some(f => f.field_name === 'headcount'));
  assert.equal(DEFAULT_RSVP_FIELDS.filter(f => rsvpFieldRole(f) === 'name').length, 1);
});
test('existing defaults normalize without mutating stored definitions or custom choices', () => {
  const original = fields([{field_name:'name',field_type:'text'},{field_name:'attending',field_type:'select',options:['Joyfully Accepts','Regretfully Declines']},{field_name:'guests',field_type:'number'},{field_name:'meal',field_type:'select',options:['Joyfully Accepts','Regretfully Declines']},{field_name:'attending',field_type:'select',options:['Monday','Tuesday']}]);
  const normalized = normalizeRsvpFields(original);
  assert.equal(normalized[0].field_name,'respondent_name');assert.equal(normalized[1].field_type,'attendance');assert.equal(normalized[2].field_name,'headcount');assert.equal(normalized[3].field_type,'select');assert.equal(normalized[4].field_type,'select');assert.equal(original[1].field_type,'select');assert.equal(original[0].field_name,'name');
});
