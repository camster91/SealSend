import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { findRsvp, saveRsvp, RsvpError, type RsvpQuery } from '../src/lib/rsvp-store';
import { hashMagicToken } from '../src/lib/magic-token';
import { publicInviteUrl } from '../src/lib/public-invite-url';
import { rsvpSubmissionSchema } from '../src/lib/validations';
const event = '00000000-0000-4000-8000-000000000011';
const otherEvent = '00000000-0000-4000-8000-000000000021';
const guest = '00000000-0000-4000-8000-000000000012';
const token = 'a'.repeat(43);
const input = (status = 'attending', headcount = 1, names: string[] = []) => rsvpSubmissionSchema.parse({ respondent_name: 'QA Guest', status, headcount, plus_ones: names.map(name => ({ name })) });
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE admin_users (id UUID PRIMARY KEY);
    CREATE TABLE events (id UUID PRIMARY KEY, status TEXT, max_attendees INTEGER, allow_plus_ones BOOLEAN DEFAULT true, max_guests_per_rsvp INTEGER DEFAULT 10, rsvp_deadline TIMESTAMPTZ);
    CREATE TABLE guests (id UUID PRIMARY KEY, event_id UUID, rsvp_status TEXT, updated_at TIMESTAMPTZ);
    CREATE TABLE rsvp_responses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),event_id UUID,guest_id UUID,respondent_name TEXT,respondent_email TEXT,status TEXT,headcount INTEGER,response_data JSONB,plus_ones_data JSONB,submitted_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE plus_ones (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),event_id UUID,rsvp_response_id UUID REFERENCES rsvp_responses(id),name TEXT NOT NULL CHECK(name <> 'fail'),email TEXT,status TEXT);`);
  await db.query("INSERT INTO rsvp_responses(event_id,respondent_name,status,headcount) VALUES ($1,'Legacy response','attending',1)",[event]);
  const migration = (await readFile('apply-security-indexes.sql','utf8')).split('-- Private public-RSVP edit credentials; existing responses stay unchanged.\n')[1];
  await db.exec(migration); await db.exec(migration);
  assert.equal((await db.query<{ respondent_name: string }>('SELECT respondent_name FROM rsvp_responses')).rows[0].respondent_name,'Legacy response');
  await db.query('DELETE FROM rsvp_responses');
  await db.query("INSERT INTO events(id,status,max_attendees) VALUES ($1,'published',2),($2,'published',2)", [event, otherEvent]);
  await db.query('INSERT INTO guests(id,event_id) VALUES ($1,$2)', [guest,event]);
  const execute: RsvpQuery = async <T>(sql: string, values?: unknown[]) => ({ rows: (await db.query<T>(sql,values)).rows });
  const save = (g: string | null, t: string | undefined, data = input(), limit = 1) => db.transaction(tx => saveRsvp(async <T>(sql: string, values?: unknown[]) => ({ rows: (await tx.query<T>(sql,values)).rows }),event,g,t,data,limit));
  return { db, execute, save };
}
test('share URLs contain only the public event path, including escaped slugs', () => {
  const url = publicInviteUrl('https://sealsend.app/e/old?t=secret&edit_token=secret#guest','dinner');
  assert.equal(url,'https://sealsend.app/e/dinner');
  assert.equal(publicInviteUrl('https://sealsend.app','a/b?token=secret'),'https://sealsend.app/e/a%2Fb%3Ftoken%3Dsecret');
});
test('deadline closes new responses under the event lock but preserves authorized edits', async () => {
  const { db, save } = await fixture();
  try {
    const before = await save(null, token, input('attending', 1), 100);
    await db.query("UPDATE events SET rsvp_deadline=NOW()-INTERVAL '1 second' WHERE id=$1", [event]);
    await assert.rejects(save(guest, undefined, input('attending'), 100), /deadline has passed/);
    await assert.rejects(save(null, 'b'.repeat(43), input('not_attending'), 100), /deadline has passed/);
    const after = await save(null, token, input('not_attending'), 100);
    assert.equal(after.response.id, before.response.id);
    assert.equal(after.response.status, 'not_attending');
    assert.equal((await db.query('SELECT * FROM rsvp_responses')).rows.length, 1);
  } finally { await db.close(); }
});
test('public retries and edits keep one response at the plan limit and capacity counts only its new contribution', async () => {
  const { db, execute, save } = await fixture();
  try {
    const first = await save(null,token,input('attending',2,['Plus One']));
    const retry = await save(null,token,input('attending',2,['Plus One']));
    assert.equal(retry.response.id,first.response.id);
    assert.equal(retry.updated,true);
    assert.equal((await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM rsvp_responses')).rows[0].count,1);
    assert.equal((await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM plus_ones')).rows[0].count,1);
    assert.equal((await db.query<{ edit_token_hash: string }>('SELECT edit_token_hash FROM rsvp_responses')).rows[0].edit_token_hash,hashMagicToken(token));
    assert.equal('edit_token_hash' in retry.response,false);
    await save(null,token,input('not_attending'));
    assert.equal((await db.query<{ total: number }>("SELECT COALESCE(SUM(headcount),0)::int AS total FROM rsvp_responses WHERE status='attending'")).rows[0].total,0);
    assert.equal((await db.query('SELECT * FROM plus_ones')).rows.length,0);
    await assert.rejects(save(null,'b'.repeat(43)), RsvpError);
    assert.equal((await findRsvp(execute,event,null,token))?.status,'not_attending');
    await assert.rejects(findRsvp(execute,otherEvent,null,token), /Invalid response access/);
    assert.equal(await findRsvp(execute,event,null,'c'.repeat(43)),null);
  } finally { await db.close(); }
});
test('invited edits and reloads use the same guest response and synchronize the guest status', async () => {
  const { db, execute, save } = await fixture();
  try {
    const first = await save(guest,undefined,input('attending',2,['Plus One']));
    const second = await save(guest,undefined,input('not_attending'));
    assert.equal(first.response.id,second.response.id);
    assert.equal((await findRsvp(execute,event,guest))?.status,'not_attending');
    assert.equal((await db.query<{ rsvp_status: string }>('SELECT rsvp_status FROM guests')).rows[0].rsvp_status,'not_attending');
    assert.equal((await db.query('SELECT * FROM rsvp_responses')).rows.length,1);
  } finally { await db.close(); }
});
test('failed plus-one replacement rolls back the response and old plus-ones together', async () => {
  const { db, execute, save } = await fixture();
  try {
    await save(null,token,input('attending',2,['Original']));
    await assert.rejects(save(null,token,input('maybe',2,['fail'])));
    assert.equal((await findRsvp(execute,event,null,token))?.status,'attending');
    assert.equal((await db.query<{ name: string }>('SELECT name FROM plus_ones')).rows[0].name,'Original');
  } finally { await db.close(); }
});
test('capacity rejects net increases but allows edits that keep or release existing seats', async () => {
  const { db, save } = await fixture();
  try {
    await save(null,token,input('attending',1),100);
    await save(guest,undefined,input('attending',1),100);
    await assert.rejects(save(null,token,input('attending',2,['New']),100), /Only 1 spots remaining/);
    await save(null,token,input('attending',1),100);
    await save(guest,undefined,input('not_attending'),100);
    await save(null,token,input('attending',2,['New']),100);
    await db.query('UPDATE events SET allow_plus_ones = false WHERE id=$1',[event]);
    await assert.rejects(save(null,token,input('attending',2,['New']),100), /only add 0/);
    await save(null,token,input('attending',2),100);
    assert.equal((await db.query<{ headcount: number }>('SELECT headcount FROM rsvp_responses WHERE guest_id IS NULL')).rows[0].headcount,1);
  } finally { await db.close(); }
});
