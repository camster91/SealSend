import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { listCheckInGuests, updateCheckInGuest, checkInSchema } from '../src/lib/check-in-store';
const event='00000000-0000-4000-8000-000000000011',other='00000000-0000-4000-8000-000000000021';
const guest='00000000-0000-4000-8000-000000000012',response='00000000-0000-4000-8000-000000000013',actor='00000000-0000-4000-8000-000000000014';
test('check-in accepts exactly one event-scoped identifier', () => {
  assert.equal(checkInSchema.safeParse({rsvpResponseId:response,checkedIn:true}).success,true);
  for(const value of [{checkedIn:true},{guestId:guest,rsvpResponseId:response,checkedIn:true},{rsvpResponseId:'bad',checkedIn:true},{inviteToken:'x'.repeat(24),guestId:guest,checkedIn:true}]) assert.equal(checkInSchema.safeParse(value).success,false);
});
test('public check-in persists; wrong events and linked responses stay untouched', async () => {
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE guests(id UUID,name TEXT,event_id UUID,rsvp_status TEXT,invite_token TEXT,checked_in_at TIMESTAMPTZ,checked_in_by UUID,updated_at TIMESTAMPTZ); CREATE TABLE rsvp_responses(id UUID,respondent_name TEXT,event_id UUID,guest_id UUID,status TEXT,headcount INT,checked_in_at TIMESTAMPTZ,checked_in_by UUID,updated_at TIMESTAMPTZ);`);
    await db.query("INSERT INTO guests(id,name,event_id,rsvp_status) VALUES ($1,'Invited guest',$2,'attending')",[guest,event]);
    await db.query("INSERT INTO rsvp_responses(id,respondent_name,event_id,guest_id,status,headcount) VALUES ($1,'Public party',$2,NULL,'attending',2),($3,'Linked reply',$2,$3,'attending',1)",[response,event,guest]);
    const query=async <T>(sql:string,values?:unknown[])=>({rows:(await db.query<T>(sql,values)).rows});
    const list=await listCheckInGuests(query,event);assert.equal(list.length,2);assert.equal(list.find(g=>g.source==='public_rsvp')?.headcount,2);
    assert.equal(await updateCheckInGuest(query,other,actor,{rsvpResponseId:response,checkedIn:true}),null);
    assert.equal(await updateCheckInGuest(query,event,actor,{rsvpResponseId:guest,checkedIn:true}),null);
    const checked=await updateCheckInGuest(query,event,actor,{rsvpResponseId:response,checkedIn:true});assert.ok(checked?.checked_in_at);assert.equal(checked.source,'public_rsvp');
    const persisted=await listCheckInGuests(query,event);assert.ok(persisted.find(g=>g.id===response)?.checked_in_at);assert.equal(persisted.find(g=>g.id===guest)?.checked_in_at,null);
    assert.equal((await db.query<{checked_in_by:string}>('SELECT checked_in_by FROM rsvp_responses WHERE id=$1',[response])).rows[0].checked_in_by,actor);
    assert.equal((await updateCheckInGuest(query,event,actor,{rsvpResponseId:response,checkedIn:false}))?.checked_in_at,null);
  }finally{await db.close();}
});
