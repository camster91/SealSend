/** Disposable local integration checks for the actual template-to-RSVP journey. */
import assert from 'node:assert/strict';
import { AxeBuilder } from '@axe-core/playwright';
export async function improvementBrowserChecks({browser,origin,db}) {
  const owner='00000000-0000-4000-8000-000000000040';
  await db.query("INSERT INTO admin_users(id,email,name,password) VALUES ($1,'improvements@example.test','Improvement QA','disabled-local-qa')",[owner]);
  await db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'admin','improvement-local-host-session',NOW()+INTERVAL '1 day')",[owner]);
  const host=await browser.newContext({ignoreHTTPSErrors:true});
  await host.addCookies([{name:'sealsend_session',value:'improvement-local-host-session',url:origin}]);
  const builder=await host.newPage();
  let eventId;const contexts=[];
  try {
    await builder.goto(`${origin}/events/new`);
    await builder.getByRole('button',{name:'Community',exact:true}).click();
    assert.equal(await builder.getByRole('button',{name:'Start with Garden Wedding',exact:true}).count(),0);
    await builder.getByRole('button',{name:'Start with Community Night',exact:true}).click();
    const created=builder.waitForResponse(res=>res.request().method()==='POST'&&new URL(res.url()).pathname==='/api/events');
    await builder.getByLabel('Name of your event').fill('Template attendance QA');
    await builder.getByLabel('Name of your event').press('Tab');
    const creation=await created;assert.equal(creation.status(),201);eventId=(await creation.json()).id;
    const date=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
    await builder.getByLabel('Time zone',{exact:true}).selectOption('America/Toronto');
    await builder.getByLabel('Starts',{exact:true}).fill(`${date}T18:00`);
    await builder.getByLabel('Ends (optional)',{exact:true}).fill(`${date}T20:00`);
    await builder.getByLabel('Place name',{exact:true}).fill('QA Community Hall');
    await builder.getByLabel('Place name',{exact:true}).press('Tab');
    await builder.getByRole('button',{name:/Next: The look/}).click();
    await builder.getByRole('button',{name:/^Next: /}).click();
    await builder.getByRole('button',{name:/^Next: /}).click();
    await builder.getByRole('button',{name:'Publish',exact:true}).click();
    await builder.getByRole('heading',{name:'Your invite is live',exact:true}).waitFor();
    const details=await (await host.request.get(`${origin}/api/events/${eventId}`)).json();const slug=details.slug;
    assert.equal(details.customization.primaryColor.toLowerCase(),'#b45309');
    assert.equal(details.event_timezone,'America/Toronto');
    assert.equal((await host.request.patch(`${origin}/api/events/${eventId}`,{headers:{Origin:origin},data:{max_attendees:2}})).status(),200);
    const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:375,height:812}});contexts.push(ctx);const guest=await ctx.newPage();await guest.emulateMedia({reducedMotion:'reduce'});
    await guest.goto(`${origin}/e/${slug}`);
    await guest.getByRole('button',{name:'Submit RSVP',exact:true}).waitFor();
    assert.equal(await guest.getByRole('textbox',{name:'Full Name *',exact:true}).count(),0);
    await guest.getByLabel('Your Name *',{exact:true}).fill('Template Guest');
    await guest.getByLabel('Email Address *',{exact:true}).fill('template-guest@example.test');
    await guest.getByRole('button',{name:'Not Attending',exact:true}).click();
    await guest.getByRole('button',{name:'Submit RSVP',exact:true}).click();
    await guest.getByText('Your response has been recorded.',{exact:true}).waitFor();
    let rows=(await db.query('SELECT * FROM rsvp_responses WHERE event_id=$1',[eventId])).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,'not_attending');const rid=rows[0].id;
    await guest.reload();await guest.getByRole('button',{name:'Update your response',exact:true}).click();
    await guest.getByRole('button',{name:'Attending',exact:true}).click();
    await guest.getByLabel('Number of Guests',{exact:true}).fill('2');
    await guest.getByLabel('Name',{exact:true}).fill('Template Plus One');
    await guest.getByRole('button',{name:'Submit RSVP',exact:true}).click();
    await guest.getByText('Attending · 2 guests',{exact:true}).waitFor();
    rows=(await db.query('SELECT * FROM rsvp_responses WHERE event_id=$1',[eventId])).rows;assert.equal(rows.length,1);assert.equal(rows[0].id,rid);assert.equal(rows[0].status,'attending');assert.equal(rows[0].headcount,2);
    const summary=await (await host.request.get(`${origin}/api/events/${eventId}/responses/summary`)).json();assert.equal(summary.attendingHeadcount,2);assert.equal(summary.fields.find(f=>f.fieldName==='email').answered,1);
    await builder.goto(`${origin}/events/${eventId}`);
    await builder.getByText(/6:00\s*PM EDT/).waitFor();
    await builder.getByText('0 invited-list replies · 1 public-link replies',{exact:true}).waitFor();
    await builder.getByRole('link',{name:'Check-in',exact:true}).click();
    await builder.getByRole('textbox',{name:'Search guests',exact:true}).fill('Template Guest');
    await builder.getByRole('button',{name:/Template Guest.*Check in/}).click();
    await builder.getByRole('button',{name:/Template Guest.*Checked in/}).waitFor();
    await builder.reload();await builder.getByRole('button',{name:/Template Guest.*Checked in/}).waitFor();
    assert.ok((await db.query('SELECT checked_in_at FROM rsvp_responses WHERE id=$1',[rid])).rows[0].checked_in_at);
    await builder.getByRole('textbox',{name:'Search guests',exact:true}).fill('No such guest');await builder.getByText('No guests match your search. Try another name or clear the search.',{exact:true}).waitFor();
    assert.equal((await host.request.patch(`${origin}/api/events/00000000-0000-4000-8000-000000000011/check-in`,{headers:{Origin:origin},data:{rsvpResponseId:rid,checkedIn:false}})).status(),404);
    await db.query("UPDATE events SET rsvp_deadline=NOW()-INTERVAL '1 day' WHERE id=$1",[eventId]);
    const stranger=await browser.newContext({ignoreHTTPSErrors:true});contexts.push(stranger);const fresh=await stranger.newPage();await fresh.goto(`${origin}/e/${slug}`);await fresh.getByRole('heading',{name:'RSVPs are closed',exact:true}).waitFor();
    const rejected=await stranger.request.post(`${origin}/api/rsvp/${slug}`,{headers:{Origin:origin},data:{respondent_name:'Late Guest',status:'attending',headcount:1}});assert.equal(rejected.status(),403);assert.ok((await rejected.json()).error.includes('deadline'));
    await guest.reload();await guest.getByRole('button',{name:'Update your response',exact:true}).click();await guest.getByText('The deadline has passed. You can still update your existing response.',{exact:true}).waitFor();
    await guest.getByRole('button',{name:'Not Attending',exact:true}).click();await guest.getByRole('button',{name:'Submit RSVP',exact:true}).click();await guest.getByText('Your response has been recorded.',{exact:true}).waitFor();assert.equal((await db.query('SELECT status FROM rsvp_responses WHERE id=$1',[rid])).rows[0].status,'not_attending');
    // Recreate the stored definitions from the older shipped default. Do not rewrite any response.
    await db.query('UPDATE events SET rsvp_deadline=NULL WHERE id=$1',[eventId]);
    await db.query("UPDATE rsvp_fields SET field_name='name' WHERE event_id=$1 AND field_name='respondent_name'",[eventId]);
    await db.query("UPDATE rsvp_fields SET field_name='guests' WHERE event_id=$1 AND field_name='headcount'",[eventId]);
    await db.query("UPDATE rsvp_fields SET field_type='select',options='[\"Joyfully Accepts\",\"Regretfully Declines\"]' WHERE event_id=$1 AND field_name='attending'",[eventId]);
    await fresh.reload();await fresh.getByRole('button',{name:'Submit RSVP',exact:true}).waitFor();await fresh.getByLabel('Your Name *',{exact:true}).fill('Legacy Template Guest');await fresh.getByLabel('Email Address *',{exact:true}).fill('legacy-template@example.test');await fresh.getByRole('button',{name:'Not Attending',exact:true}).click();await fresh.getByLabel('Number of Guests',{exact:true}).fill('2');await fresh.getByLabel('Name',{exact:true}).fill('Legacy Plus One');
    for(const width of [375,768,1440]) {
      await fresh.setViewportSize({width,height:1000});
      await fresh.locator('form[aria-label="RSVP"]').scrollIntoViewIfNeeded();
      await fresh.waitForFunction(() => {
        let element=document.querySelector('form[aria-label="RSVP"]');
        if(!element) return false;
        while(element) {
          if(Number(getComputedStyle(element).opacity)<0.999) return false;
          element=element.parentElement;
        }
        return true;
      });
      const axe=await new AxeBuilder({page:fresh}).include('[aria-label="RSVP"]').analyze();
      assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)),[],`legacy form accessibility at ${width}px`);
    }
    await fresh.getByRole('button',{name:'Submit RSVP',exact:true}).click();await fresh.getByText('Your response has been recorded.',{exact:true}).waitFor();const legacy=(await db.query("SELECT status,headcount FROM rsvp_responses WHERE event_id=$1 AND respondent_name='Legacy Template Guest'",[eventId])).rows[0];assert.equal(legacy.status,'not_attending');assert.equal(legacy.headcount,2);
    console.log('PASS actual Community Night publication, canonical/default/legacy RSVP status and headcount, one-name form, saved confirmation, timezone, public manual check-in/reload, event isolation, deadline UI/API and responsive accessibility');
  }finally{await Promise.all(contexts.map(ctx=>ctx.close()));await host.close();if(eventId)await db.query('DELETE FROM events WHERE id=$1 AND user_id=$2',[eventId,owner]);await db.query('DELETE FROM user_sessions WHERE user_id=$1',[owner]);await db.query('DELETE FROM activation_events WHERE user_id=$1',[owner]);await db.query('DELETE FROM organizations WHERE created_by=$1',[owner]);await db.query('DELETE FROM admin_users WHERE id=$1',[owner]);}
}
