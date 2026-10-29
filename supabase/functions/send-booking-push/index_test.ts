import assert from 'node:assert/strict';
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'web-push';
import {allowedPushEndpoint,handleRequest} from './handler.ts';
import {bookingNotification} from '../_shared/booking-notification.ts';

Deno.test('webhook auth, events, privacy, deduplication, retries and stale subscriptions (local only)',async()=>{
 const shop='11111111-1111-1111-1111-111111111111',id='33333333-3333-3333-3333-333333333333';
 const base={id,barbershop_id:shop,barber_id:'22222222-2222-2222-2222-222222222221',status:'hold',starts_at:'2026-10-29T12:00:00Z',ends_at:'2026-10-29T12:30:00Z',hold_expires_at:new Date(Date.now()+900000).toISOString(),updated_at:'2026-10-29T11:00:00Z'};
 let row={...base,barbers:{name:'Carlos'},booking_items:[{service_name:'Corte'}]},subscriptions=[{id:'sub-1',user_id:'owner',endpoint:'https://fcm.googleapis.com/fcm/send/fixture',p256dh:'fixture',auth:'fixture'}];
 let sends=0,failStatus=0,lastPayload='',member=true;
 const deliveries=new Map<string,{delivered_at:string|null;locked_until:string}>();
 const server=Deno.serve({hostname:'127.0.0.1',port:0,onListen:()=>{}},async req=>{
  const url=new URL(req.url),table=url.pathname.split('/').pop();
  const reply=(data:unknown)=>Response.json(data);
  if(table==='bookings')return reply(row);
  if(table==='shop_members')return reply(member?[{user_id:'owner'}]:[]);
  if(table==='push_subscriptions'){
   if(req.method==='DELETE'){subscriptions=[];return new Response(null,{status:204});}
   return reply(subscriptions);
  }
  if(table==='claim_booking_push_delivery'){
   const {p_event_key,p_subscription_id}=await req.json(),deliveryKey=p_event_key+':'+p_subscription_id,current=deliveries.get(deliveryKey);
   if(current&&(current.delivered_at||Date.parse(current.locked_until)>Date.now()))return reply(false);
   deliveries.set(deliveryKey,{delivered_at:null,locked_until:new Date(Date.now()+90000).toISOString()});return reply(true);
  }
  if(table==='booking_push_deliveries'){
   const key=url.searchParams.get('event_key')!.slice(3)+':'+url.searchParams.get('subscription_id')!.slice(3);deliveries.set(key,{...deliveries.get(key)!,...await req.json()});return new Response(null,{status:204});
  }
  return reply([]);
 });
 const secret=crypto.randomUUID()+crypto.randomUUID(),keys=webpush.generateVAPIDKeys();
 const vars={SUPABASE_URL:`http://127.0.0.1:${server.addr.port}`,SUPABASE_SERVICE_ROLE_KEY:'fixture-service-role',BOOKING_WEBHOOK_SECRET:secret,VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'mailto:qa@example.test'};
 const original=Object.fromEntries(Object.keys(vars).map(key=>[key,Deno.env.get(key)]));
 for(const [key,value]of Object.entries(vars))Deno.env.set(key,value);
 const oldSend=webpush.sendNotification;
 webpush.sendNotification=async(_subscription,payload)=>{sends++;lastPayload=String(payload);if(failStatus)throw Object.assign(new Error('fixture'),{statusCode:failStatus});return {statusCode:201,body:'',headers:{}};};
 const request=(type='INSERT',old:unknown={},header=secret)=>new Request('http://localhost/function',{method:'POST',headers:{'x-booking-webhook-secret':header},body:JSON.stringify({type,schema:'public',table:'bookings',record:row,old_record:old})});
 try{
  assert.equal((await handleRequest(new Request('http://localhost'))).status,405);
  assert.equal((await handleRequest(request('INSERT',{},'wrong'))).status,401);assert.equal(sends,0);
  assert.equal((await handleRequest(request())).status,200);assert.equal(sends,1);
  assert.match(lastPayload,/Nova pré-reserva/);assert.match(lastPayload,/09:00/);assert(!/customer|phone|auth|p256dh|endpoint|total_price/.test(lastPayload));
  await handleRequest(request());assert.equal(sends,1,'duplicate webhook must not send twice');
  const equivalent=new Request('http://localhost/function',{method:'POST',headers:{'x-booking-webhook-secret':secret},body:JSON.stringify({type:'INSERT',schema:'public',table:'bookings',record:{...row,starts_at:'2026-10-29T09:00:00-03:00',ends_at:'2026-10-29T09:30:00-03:00',updated_at:'2026-10-29T11:00:00.000+00:00'},old_record:{}})});
  assert.equal((await(await handleRequest(equivalent)).json()).skipped,undefined,'equivalent timestamps must not be mistaken for a stale event');assert.equal(sends,1);
  row={...row,status:'confirmed',updated_at:'2026-10-29T11:01:00Z'};
  await handleRequest(request('UPDATE',base));assert.equal(sends,2);assert.match(lastPayload,/Reserva confirmada/);
  const confirmed={...row};row={...row,updated_at:'2026-10-29T11:02:00Z'};
  await handleRequest(request('UPDATE',confirmed));assert.equal(sends,2,'unrelated UPDATE must not notify');
  row={...row,status:'cancelled',updated_at:'2026-10-29T11:03:00Z'};
  await handleRequest(request('UPDATE',confirmed));assert.equal(sends,3);assert.match(lastPayload,/Reserva cancelada/);
  const moved={...confirmed,starts_at:'2026-10-29T20:00:00Z',ends_at:'2026-10-29T20:30:00Z',updated_at:'2026-10-29T11:03:30Z'};
  assert.equal(bookingNotification('UPDATE',moved,confirmed)?.title,'Reserva alterada');
  row={...row,...base,hold_expires_at:new Date(Date.now()-1000).toISOString()};await handleRequest(request());assert.equal(sends,3,'expired hold');
  row={...row,...base,updated_at:'2026-10-29T11:04:00Z'};failStatus=503;
  assert.equal((await handleRequest(request())).status,503);failStatus=0;
  assert.equal((await handleRequest(request())).status,200);assert.equal(sends,5,'failed delivery can retry');
  row={...row,updated_at:'2026-10-29T11:05:00Z'};failStatus=410;
  await handleRequest(request());assert.equal(subscriptions.length,0,'gone endpoint removed');
  subscriptions=[{id:'sub-404',user_id:'owner',endpoint:'https://fcm.googleapis.com/fcm/send/notfound',p256dh:'fixture',auth:'fixture'}];failStatus=404;
  await handleRequest(request());assert.equal(subscriptions.length,0,'404 endpoint removed');
  subscriptions=[{id:'sub-2',user_id:'owner',endpoint:'https://fcm.googleapis.com/fcm/send/fixture',p256dh:'fixture',auth:'fixture'}];member=false;
  await handleRequest(request());assert.equal(subscriptions.length,0,'ex-member not notified');
  const stale=request();row={...row,updated_at:'2026-10-29T11:06:00Z'};
  assert.equal((await(await handleRequest(stale)).json()).skipped,'stale event');
  assert.equal(bookingNotification('UPDATE',base,{id:base.id}),null,'old primary key alone cannot imply confirmation');
  for(const url of ['http://localhost','https://127.0.0.1/a','https://fcm.googleapis.com.attacker.test/a','https://user@fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a'])assert(!allowedPushEndpoint(url));
  for(const url of ['https://fcm.googleapis.com/fcm/send/test','https://updates.push.services.mozilla.com/wpush/v2/test','https://web.push.apple.com/test'])assert(allowedPushEndpoint(url));
 }finally{
  webpush.sendNotification=oldSend;
  for(const [key,value]of Object.entries(original)){if(value===undefined)Deno.env.delete(key);else Deno.env.set(key,value);}
  await server.shutdown();
 }
});
