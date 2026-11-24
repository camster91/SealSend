import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../src/lib/db/sqlite-local';
import { findRsvp, saveRsvp, RsvpError } from '../src/lib/rsvp-store';
import { hashMagicToken } from '../src/lib/magic-token';
import { publicInviteUrl } from '../src/lib/public-invite-url';
import { rsvpSubmissionSchema } from '../src/lib/validations';
const event = '00000000-0000-4000-8000-000000000011';
const otherEvent = '00000000-0000-4000-8000-000000000021';
const guest = '00000000-0000-4000-8000-000000000012';
const token = 'a'.repeat(43);
const input = (status = 'attending', headcount = 1, names: string[] = []) => rsvpSubmissionSchema.parse({ respondent_name: 'QA Guest', status, headcount, plus_ones: names.map(name => ({ name })) });
async function fixture() {
  const db = openTestDb();
  // Stands in for any failing write in the batch (the old fixture used a CHECK constraint).
  await db.exec("CREATE TRIGGER fail_plus_one BEFORE INSERT ON plus_ones WHEN NEW.name = 'fail' BEGIN SELECT RAISE(ABORT, 'plus-one rejected'); END");
  await db.query("INSERT INTO events(id,user_id,title,slug,status,max_attendees) VALUES ($1,'host','Event','event','published',2),($2,'host','Other','other','published',2)", [event, otherEvent]);
  await db.query("INSERT INTO guests(id,event_id,name) VALUES ($1,$2,'Guest')", [guest,event]);
  const save = (g: string | null, t: string | undefined, data = input(), limit = 1) => saveRsvp(db,event,g,t,data,limit);
  return { db, execute: db, save };
}
test('share URLs contain only the public event path, including escaped slugs', () => {
  const url = publicInviteUrl('https://sealsend.app/e/old?t=secret&edit_token=secret#guest','dinner');
  assert.equal(url,'https://sealsend.app/e/dinner');
  assert.equal(publicInviteUrl('https://sealsend.app','a/b?token=secret'),'https://sealsend.app/e/a%2Fb%3Ftoken%3Dsecret');
});
test('deadline closes new responses but preserves authorized edits', async () => {
  const { db, save } = await fixture();
  try {
    const before = await save(null, token, input('attending', 1), 100);
    await db.query("UPDATE events SET rsvp_deadline=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 seconds') WHERE id=$1", [event]);
    await assert.rejects(save(guest, undefined, input('attending'), 100), /deadline has passed/);
    await assert.rejects(save(null, 'b'.repeat(43), input('not_attending'), 100), /deadline has passed/);
    const after = await save(null, token, input('not_attending'), 100);
    assert.equal(after.response.id, before.response.id);
    assert.equal(after.response.status, 'not_attending');
    assert.equal((await db.query('SELECT * FROM rsvp_responses')).length, 1);
  } finally { db.handle.close(); }
});
test('public retries and edits keep one response at the plan limit and capacity counts only its new contribution', async () => {
  const { db, execute, save } = await fixture();
  try {
    const first = await save(null,token,input('attending',2,['Plus One']));
    const retry = await save(null,token,input('attending',2,['Plus One']));
    assert.equal(retry.response.id,first.response.id);
    assert.equal(retry.updated,true);
    assert.equal((await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM rsvp_responses'))[0].count,1);
    assert.equal((await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM plus_ones'))[0].count,1);
    assert.equal((await db.query<{ edit_token_hash: string }>('SELECT edit_token_hash FROM rsvp_responses'))[0].edit_token_hash,hashMagicToken(token));
    assert.equal('edit_token_hash' in retry.response,false);
    await save(null,token,input('not_attending'));
    assert.equal((await db.query<{ total: number }>("SELECT COALESCE(SUM(headcount),0) AS total FROM rsvp_responses WHERE status='attending'"))[0].total,0);
    assert.equal((await db.query('SELECT * FROM plus_ones')).length,0);
    await assert.rejects(save(null,'b'.repeat(43)), RsvpError);
    assert.equal((await findRsvp(execute,event,null,token))?.status,'not_attending');
    await assert.rejects(findRsvp(execute,otherEvent,null,token), /Invalid response access/);
    assert.equal(await findRsvp(execute,event,null,'c'.repeat(43)),null);
  } finally { db.handle.close(); }
});
test('invited edits and reloads use the same guest response and synchronize the guest status', async () => {
  const { db, execute, save } = await fixture();
  try {
    const first = await save(guest,undefined,input('attending',2,['Plus One']));
    const second = await save(guest,undefined,input('not_attending'));
    assert.equal(first.response.id,second.response.id);
    assert.equal((await findRsvp(execute,event,guest))?.status,'not_attending');
    assert.equal((await db.query<{ rsvp_status: string }>('SELECT rsvp_status FROM guests'))[0].rsvp_status,'not_attending');
    assert.equal((await db.query('SELECT * FROM rsvp_responses')).length,1);
  } finally { db.handle.close(); }
});
test('failed plus-one replacement rolls back the response and old plus-ones together', async () => {
  const { db, execute, save } = await fixture();
  try {
    await save(null,token,input('attending',2,['Original']));
    await assert.rejects(save(null,token,input('maybe',2,['fail'])));
    assert.equal((await findRsvp(execute,event,null,token))?.status,'attending');
    assert.equal((await db.query<{ name: string }>('SELECT name FROM plus_ones'))[0].name,'Original');
  } finally { db.handle.close(); }
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
    assert.equal((await db.query<{ headcount: number }>('SELECT headcount FROM rsvp_responses WHERE guest_id IS NULL'))[0].headcount,1);
  } finally { db.handle.close(); }
});
test('concurrent replies keep the plan limit, capacity and one response per guest', async () => {
  const { db, save } = await fixture();
  try {
    // node:sqlite is synchronous, so these interleave at each await: every save reads before the others write.
    const limited = await Promise.allSettled(['d', 'e', 'f'].map(c => save(null, c.repeat(43), input('attending', 1), 1)));
    assert.equal(limited.filter(r => r.status === 'fulfilled').length, 1);
    for (const r of limited) if (r.status === 'rejected') assert.match(String(r.reason), /maximum number of responses/);
    await db.query('DELETE FROM rsvp_responses');

    const full = await Promise.allSettled(['g', 'h', 'i'].map(c => save(null, c.repeat(43), input('attending', 1), 100)));
    assert.equal(full.filter(r => r.status === 'fulfilled').length, 2);
    for (const r of full) if (r.status === 'rejected') assert.ok(r.reason instanceof RsvpError && /maximum number of attendees/.test(r.reason.message));
    assert.equal((await db.query<{ total: number }>("SELECT SUM(headcount) AS total FROM rsvp_responses WHERE status='attending'"))[0].total, 2);
    await db.query('DELETE FROM rsvp_responses');

    const twice = await Promise.all([save(guest, undefined, input('maybe'), 100), save(guest, undefined, input('not_attending'), 100)]);
    assert.equal(twice[0].response.id, twice[1].response.id);
    assert.deepEqual(twice.map(r => r.updated).sort(), [false, true]);
    assert.equal((await db.query('SELECT * FROM rsvp_responses WHERE guest_id = $1', [guest])).length, 1);
  } finally { db.handle.close(); }
});
