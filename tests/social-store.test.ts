import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../src/lib/db/sqlite-local';
import { loadSocialState } from '../src/lib/social/store';
export async function socialFixture() {
  // The social tables and their cleanup trigger are part of the app schema.
  const db = openTestDb();
  const event = '00000000-0000-4000-8000-000000000001';
  const guest = '00000000-0000-4000-8000-000000000002';
  await db.query("INSERT INTO events(id, user_id, title, slug, status) VALUES ($1,'host','Event','social','published')", [event]);
  await db.query("INSERT INTO guests(id,event_id,name) VALUES ($1,$2,'Guest')", [guest, event]);
  return { db, execute: db, event, guest };
}
const respond = (db: Awaited<ReturnType<typeof socialFixture>>['db'], event: string, guest: string, status: string, submittedAt: string) =>
  db.query("INSERT INTO rsvp_responses(event_id,guest_id,respondent_name,status,submitted_at) VALUES ($1,$2,'Guest',$3,$4)", [event, guest, status, new Date(submittedAt)]);
test('public guest names require opt-in and latest attending reply', async () => {
  const { db, execute, event, guest } = await socialFixture();
  try {
    await db.query('INSERT INTO event_social_settings(event_id,guests_enabled) VALUES ($1,true)', [event]);
    await respond(db, event, guest, 'attending', '2026-01-01');
    assert.deepEqual((await loadSocialState(event, guest, null, false, execute)).guests, []);
    await db.query('INSERT INTO event_social_guests(event_id,guest_id,show_name) VALUES ($1,$2,true)', [event, guest]);
    assert.deepEqual((await loadSocialState(event, guest, null, false, execute)).guests, [{ name: 'Guest' }]);
    await respond(db, event, guest, 'not_attending', '2026-01-02');
    assert.deepEqual((await loadSocialState(event, guest, null, false, execute)).guests, []);
  } finally { db.handle.close(); }
});
test('guest state hides pending photos from other guests and never exposes file paths', async () => {
  const { db, execute, event, guest } = await socialFixture();
  try {
    await db.query('INSERT INTO event_social_settings(event_id,photos_enabled) VALUES ($1,true)', [event]);
    await db.query("INSERT INTO event_social_photos(event_id,guest_id,storage_path) VALUES ($1,$2,'/uploads/private')", [event, guest]);
    const own = await loadSocialState(event, guest, null, false, execute);
    assert.equal(own.photos.length, 1);
    assert.equal(own.photos[0].own, true);
    assert.equal(own.photos[0].approved, false);
    assert.equal('storage_path' in own.photos[0], false);
    assert.equal((await loadSocialState(event, null, null, false, execute)).photos.length, 0);
    assert.equal((await loadSocialState(event, null, null, true, execute)).photos.length, 1);
  } finally { db.handle.close(); }
});

test('changing votes and reactions keeps one record per guest; closed and foreign polls reject votes', async () => {
  const { applyGuestAction, applyHostAction } = await import('../src/lib/social/actions');
  const { db, execute, event, guest } = await socialFixture();
  try {
    await db.query('INSERT INTO event_social_settings(event_id,polls_enabled,reactions_enabled) VALUES ($1,true,true)', [event]);
    await applyHostAction(event, { action: 'poll', poll: { question: 'Which?', options: ['A','B'] } }, execute);
    const poll = (await db.query<{ id: string }>('SELECT id FROM event_social_polls'))[0].id;
    await Promise.all([0,1,0,1].map(option_index => applyGuestAction(event,guest,{ action: 'vote', poll_id: poll, option_index },execute)));
    assert.equal((await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM event_social_votes'))[0].count,1);
    assert.equal(await applyGuestAction(event,guest,{ action:'vote',poll_id:poll,option_index:5 },execute),false);
    await applyHostAction(event,{ action:'close_poll',id:poll,closed:true },execute);
    assert.equal(await applyGuestAction(event,guest,{ action:'vote',poll_id:poll,option_index:0 },execute),false);
    assert.equal(await applyGuestAction('00000000-0000-4000-8000-000000000099',guest,{ action:'vote',poll_id:poll,option_index:0 },execute),false);
    for (const reaction of ['excited','love',null] as const) await applyGuestAction(event,guest,{ action:'reaction',reaction },execute);
    const state = await loadSocialState(event,guest,null,true,execute);
    assert.deepEqual(state.reactions,{});
    assert.equal(state.mine.reaction,null);
    assert.deepEqual(state.polls[0].options,['A','B']);
    assert.equal(state.polls[0].closed,true);
    assert.equal(state.polls[0].counts.reduce((a,b)=>a+b,0),1);
  } finally { db.handle.close(); }
});

test('the poll limit holds when polls are created concurrently', async () => {
  const { applyHostAction } = await import('../src/lib/social/actions');
  const { db, execute, event } = await socialFixture();
  try {
    const created = await Promise.all(Array.from({ length: 25 }, (_, i) =>
      applyHostAction(event, { action: 'poll', poll: { question: `Q${i}`, options: ['A','B'] } }, execute)));
    assert.equal(created.filter(Boolean).length, 20);
    assert.equal((await db.query<{ count: number }>('SELECT COUNT(*) AS count FROM event_social_polls'))[0].count, 20);
  } finally { db.handle.close(); }
});

test('guest and event cascades durably queue photo paths, only after commit', async () => {
  const { db, event, guest } = await socialFixture();
  try {
    await db.query('INSERT INTO event_social_guests(event_id,guest_id) VALUES ($1,$2)',[event,guest]);
    await db.query("INSERT INTO event_social_photos(event_id,guest_id,storage_path) VALUES ($1,$2,'/uploads/owner/social-private/guest.webp')",[event,guest]);
    // A failing batch rolls the cascade (and the trigger's queue row) back.
    await assert.rejects(db.batch([
      { text: 'DELETE FROM guests WHERE id=$1', params: [guest] },
      { text: "SELECT json_extract('{}', '$bad') AS fail" },
    ]));
    assert.equal((await db.query('SELECT * FROM event_social_photos')).length,1);
    assert.equal((await db.query('SELECT * FROM event_social_file_cleanup')).length,0);
    await db.query('DELETE FROM guests WHERE id=$1',[guest]);
    assert.deepEqual((await db.query('SELECT storage_path FROM event_social_file_cleanup')),[{storage_path:'/uploads/owner/social-private/guest.webp'}]);
    await db.query("INSERT INTO guests(id,event_id,name) VALUES ($1,$2,'Guest')",[guest,event]);
    await db.query("INSERT INTO event_social_photos(event_id,guest_id,storage_path) VALUES ($1,$2,'/uploads/owner/social-private/event.webp')",[event,guest]);
    await db.query('DELETE FROM events WHERE id=$1',[event]);
    assert.deepEqual((await db.query('SELECT * FROM event_social_guests')),[]);
    assert.deepEqual((await db.query('SELECT * FROM event_social_photos')),[]);
    assert.equal((await db.query('SELECT * FROM event_social_file_cleanup')).length,2);
  } finally { db.handle.close(); }
});
