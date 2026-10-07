/** Local synthetic fixtures only. No provider configuration or production data. */
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { hash } from 'bcryptjs';

export async function startSocialQa() {
const db = await PGlite.create();
const schema = (await readFile('src/lib/db/schema.sql','utf8')).replace(/^CREATE EXTENSION.*$/gm,'');
await db.exec(schema);
const owner = '00000000-0000-4000-8000-000000000010';
const event = '00000000-0000-4000-8000-000000000011';
const guest = '00000000-0000-4000-8000-000000000012';
const other = '00000000-0000-4000-8000-000000000013';
const builderOwner = '00000000-0000-4000-8000-000000000020';
const password = await hash('Local-QA-only-Password-42',10);
await db.query('INSERT INTO admin_users(id,email,name,password) VALUES ($1,$2,$3,$4),($5,$6,$7,$4)',[owner,'social-qa@example.test','Social QA',password,builderOwner,'builder-qa@example.test','Builder QA']);
await db.query("INSERT INTO events(id,user_id,title,slug,status,event_date,event_timezone,location_name,location_address,host_name) VALUES ($1,$2,'Social QA event','social-qa','published',NOW()+INTERVAL '14 days','America/Toronto','QA Hall','123 Example Street','QA Host')",[event,owner]);
await db.query("INSERT INTO guests(id,event_id,name,email,invite_token,invite_status) VALUES ($1,$2,'Invited Guest','guest@example.test',$3,'sent'),($4,$2,'Other Guest','other@example.test',$5,'sent')",[guest,event,'a'.repeat(24),other,'b'.repeat(24)]);
await db.query("INSERT INTO rsvp_responses(event_id,guest_id,respondent_name,status,headcount) VALUES ($1,$2,'Invited Guest','attending',1)",[event,guest]);
await db.query("INSERT INTO event_social_settings(event_id,guests_enabled,reactions_enabled,polls_enabled,photos_enabled,countdown_enabled) VALUES ($1,true,true,true,true,true)",[event]);
await db.query("INSERT INTO event_social_polls(event_id,question,options) VALUES ($1,'Which snack?', '[\"Fruit\",\"Crackers\"]')",[event]);
await db.query("INSERT INTO user_sessions(user_id,user_role,session_token,expires_at) VALUES ($1,'admin','social-local-host-session',NOW()+INTERVAL '1 day')",[owner]);
const server = new PGLiteSocketServer({ db,host:'127.0.0.1',port:55432,maxConnections:20 });
await server.start();
console.log('Synthetic local QA database ready on 127.0.0.1:55432.');
const stop = async () => { await server.stop(); await db.close(); process.exit(0); };
process.on('SIGINT',stop); process.on('SIGTERM',stop);
return { db,server }; 

}
if (process.argv[1]?.endsWith('start-social-qa.ts')) void startSocialQa().catch(error => { console.error(error); process.exit(1); });
