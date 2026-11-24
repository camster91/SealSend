import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../src/lib/db/sqlite-local';
import { listCheckInGuests, updateCheckInGuest, checkInSchema } from '../src/lib/check-in-store';
const event='00000000-0000-4000-8000-000000000011',other='00000000-0000-4000-8000-000000000021';
const guest='00000000-0000-4000-8000-000000000012',response='00000000-0000-4000-8000-000000000013',actor='00000000-0000-4000-8000-000000000014';
test('check-in accepts exactly one event-scoped identifier', () => {
  assert.equal(checkInSchema.safeParse({rsvpResponseId:response,checkedIn:true}).success,true);
  for(const value of [{checkedIn:true},{guestId:guest,rsvpResponseId:response,checkedIn:true},{rsvpResponseId:'bad',checkedIn:true},{inviteToken:'x'.repeat(24),guestId:guest,checkedIn:true}]) assert.equal(checkInSchema.safeParse(value).success,false);
});
test('public check-in persists; wrong events and linked responses stay untouched', async () => {
  const db=openTestDb();
  try{
    await db.query("INSERT INTO admin_users(id,email,password) VALUES ($1,'host@example.com','x')",[actor]);
    await db.query("INSERT INTO events(id,user_id,title,slug) VALUES ($1,$3,'Event','event'),($2,$3,'Other','other')",[event,other,actor]);
    await db.query("INSERT INTO guests(id,name,event_id,rsvp_status) VALUES ($1,'Invited guest',$2,'attending')",[guest,event]);
    await db.query("INSERT INTO rsvp_responses(id,respondent_name,event_id,guest_id,status,headcount) VALUES ($1,'Public party',$2,NULL,'attending',2),($3,'Linked reply',$2,$3,'attending',2)",[response,event,guest]);
    const list=await listCheckInGuests(db,event);assert.equal(list.length,2);assert.equal(list.find(g=>g.source==='public_rsvp')?.headcount,2);
    assert.equal(await updateCheckInGuest(db,other,actor,{rsvpResponseId:response,checkedIn:true}),null);
    assert.equal(await updateCheckInGuest(db,event,actor,{rsvpResponseId:guest,checkedIn:true}),null);
    const checked=await updateCheckInGuest(db,event,actor,{rsvpResponseId:response,checkedIn:true});assert.ok(checked?.checked_in_at);assert.equal(checked.source,'public_rsvp');
    const persisted=await listCheckInGuests(db,event);assert.ok(persisted.find(g=>g.id===response)?.checked_in_at);assert.equal(persisted.find(g=>g.id===guest)?.checked_in_at,null);
    assert.equal((await db.queryOne<{checked_in_by:string}>('SELECT checked_in_by FROM rsvp_responses WHERE id=$1',[response]))?.checked_in_by,actor);
    assert.equal((await updateCheckInGuest(db,event,actor,{rsvpResponseId:response,checkedIn:false}))?.checked_in_at,null);
    assert.equal((await updateCheckInGuest(db,event,actor,{guestId:guest,checkedIn:true}))?.headcount,2);
    assert.equal((await listCheckInGuests(db,event)).find(g=>g.id===guest)?.headcount,2);
  }finally{db.handle.close();}
});
