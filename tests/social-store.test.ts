import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { SOCIAL_SCHEMA_SQL } from '../src/lib/social/schema';
import { loadSocialState, type SocialQuery } from '../src/lib/social/store';
export async function socialFixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE events (id UUID PRIMARY KEY, user_id UUID, event_date TIMESTAMPTZ, status TEXT, slug TEXT);
    CREATE TABLE guests (id UUID PRIMARY KEY, event_id UUID REFERENCES events(id) ON DELETE CASCADE, name TEXT);
    CREATE TABLE rsvp_responses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID, guest_id UUID, status TEXT, submitted_at TIMESTAMPTZ DEFAULT NOW());`);
  await db.exec(SOCIAL_SCHEMA_SQL);
  await db.exec(SOCIAL_SCHEMA_SQL);
  const event = '00000000-0000-4000-8000-000000000001';
  const guest = '00000000-0000-4000-8000-000000000002';
  await db.query("INSERT INTO events(id, status) VALUES ($1,'published')", [event]);
  await db.query("INSERT INTO guests(id,event_id,name) VALUES ($1,$2,'Guest')", [guest, event]);
  const execute: SocialQuery = async <T>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows;
  return { db, execute, event, guest };
}
test('schema applies twice and public guest names require opt-in and latest attending reply', async () => {
  const { db, execute, event, guest } = await socialFixture();
  try {
    await db.query('INSERT INTO event_social_settings(event_id,guests_enabled) VALUES ($1,true)', [event]);
    await db.query("INSERT INTO rsvp_responses(event_id,guest_id,status,submitted_at) VALUES ($1,$2,'attending','2026-01-01')", [event, guest]);
    assert.deepEqual((await loadSocialState(event, guest, null, false, execute)).guests, []);
    await db.query('INSERT INTO event_social_guests(event_id,guest_id,show_name) VALUES ($1,$2,true)', [event, guest]);
    assert.deepEqual((await loadSocialState(event, guest, null, false, execute)).guests, [{ name: 'Guest' }]);
    await db.query("INSERT INTO rsvp_responses(event_id,guest_id,status,submitted_at) VALUES ($1,$2,'not_attending','2026-01-02')", [event, guest]);
    assert.deepEqual((await loadSocialState(event, guest, null, false, execute)).guests, []);
  } finally { await db.close(); }
});
test('guest state hides pending photos from other guests and never exposes file paths', async () => {
  const { db, execute, event, guest } = await socialFixture();
  try {
    await db.query('INSERT INTO event_social_settings(event_id,photos_enabled) VALUES ($1,true)', [event]);
    await db.query("INSERT INTO event_social_photos(event_id,guest_id,storage_path) VALUES ($1,$2,'/uploads/private')", [event, guest]);
    const own = await loadSocialState(event, guest, null, false, execute);
    assert.equal(own.photos.length, 1);
    assert.equal('storage_path' in own.photos[0], false);
    assert.equal((await loadSocialState(event, null, null, false, execute)).photos.length, 0);
    assert.equal((await loadSocialState(event, null, null, true, execute)).photos.length, 1);
  } finally { await db.close(); }
});

test('changing votes and reactions keeps one record per guest; closed and foreign polls reject votes', async () => {
  const { applyGuestAction, applyHostAction } = await import('../src/lib/social/actions');
  const { db, execute, event, guest } = await socialFixture();
  try {
    await db.query('INSERT INTO event_social_settings(event_id,polls_enabled,reactions_enabled) VALUES ($1,true,true)', [event]);
    await applyHostAction(event, { action: 'poll', poll: { question: 'Which?', options: ['A','B'] } }, execute);
    const poll = (await db.query<{ id: string }>('SELECT id FROM event_social_polls')).rows[0].id;
    await Promise.all([0,1,0,1].map(option_index => applyGuestAction(event,guest,{ action: 'vote', poll_id: poll, option_index },execute)));
    assert.equal((await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM event_social_votes')).rows[0].count,1);
    assert.equal(await applyGuestAction(event,guest,{ action:'vote',poll_id:poll,option_index:5 },execute),false);
    await applyHostAction(event,{ action:'close_poll',id:poll,closed:true },execute);
    assert.equal(await applyGuestAction(event,guest,{ action:'vote',poll_id:poll,option_index:0 },execute),false);
    assert.equal(await applyGuestAction('00000000-0000-4000-8000-000000000099',guest,{ action:'vote',poll_id:poll,option_index:0 },execute),false);
    for (const reaction of ['excited','love',null] as const) await applyGuestAction(event,guest,{ action:'reaction',reaction },execute);
    const state = await loadSocialState(event,guest,null,false,execute);
    assert.deepEqual(state.reactions,{});
    assert.equal(state.mine.reaction,null);
    assert.equal(state.polls[0].counts.reduce((a,b)=>a+b,0),1);
  } finally { await db.close(); }
});

test('event deletion cascades through all social records', async () => {
  const { db, event, guest } = await socialFixture();
  try {
    await db.query('INSERT INTO event_social_guests(event_id,guest_id) VALUES ($1,$2)',[event,guest]);
    await db.query('DELETE FROM events WHERE id=$1',[event]);
    assert.deepEqual((await db.query('SELECT * FROM event_social_guests')).rows,[]);
  } finally { await db.close(); }
});
