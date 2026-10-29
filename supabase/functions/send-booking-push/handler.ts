import {createClient} from '@supabase/supabase-js';
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'web-push';
import {bookingNotification,bookingNotificationBody,notificationEventId,type NotificationBooking} from '../_shared/booking-notification.ts';

const json=(body:unknown,status=200)=>Response.json(body,{status});
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function allowedPushEndpoint(endpoint:string){
 try{const url=new URL(endpoint);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(
  ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname)
 );}catch{return false;}
}
async function secretMatches(actual:string,expected:string){
 const hash=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [a,b]=await Promise.all([hash(actual),hash(expected)]);let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];return mismatch===0;
}
export async function handleRequest(request:Request){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=Deno.env.get('BOOKING_WEBHOOK_SECRET');
 if(!secret||secret.length<32)return json({error:'Webhook not configured'},503);
 if(!await secretMatches(request.headers.get('x-booking-webhook-secret')||'',secret))return json({error:'Unauthorized'},401);
 if(Number(request.headers.get('content-length')||0)>65536)return json({error:'Payload too large'},413);
 let event;
 try{const body=await request.text();if(body.length>65536)return json({error:'Payload too large'},413);event=JSON.parse(body);}catch{return json({error:'Invalid JSON'},400);}
 if(event.schema!=='public'||event.table!=='bookings'||!['INSERT','UPDATE'].includes(event.type)||!uuid.test(event.record?.id||'')||!uuid.test(event.record?.barbershop_id||''))return json({error:'Invalid booking event'},400);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT');
 if(!url||!key||!publicKey||!privateKey||!subject)return json({error:'Push secrets missing'},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const {data:row,error}=await db.from('bookings').select('id,barbershop_id,barber_id,status,starts_at,ends_at,hold_expires_at,updated_at,created_at,barbers(name),booking_items(service_name)').eq('id',event.record.id).eq('barbershop_id',event.record.barbershop_id).maybeSingle();
  if(error)throw error;if(!row)return json({skipped:'booking not found'});
  const notification=bookingNotification(event.type,event.record,event.old_record||{});
  if(!notification)return json({skipped:'expired or irrelevant event'});
  const current=bookingNotification(event.type,row as NotificationBooking,event.old_record||{});
  if(!current||current.key!==notification.key)return json({skipped:'stale event'});
  const eventId=await notificationEventId(notification.key);
  const barber=row.barbers as unknown as {name:string}|null;
  const items=row.booking_items as {service_name:string}[];
  const payload=JSON.stringify({eventId,title:notification.title,body:bookingNotificationBody(row as NotificationBooking,barber?.name||'Profissional',items.map(item=>item.service_name))});
  const subscriptions=await db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').eq('barbershop_id',row.barbershop_id);
  if(subscriptions.error)throw subscriptions.error;
  const members=await db.from('shop_members').select('user_id').eq('barbershop_id',row.barbershop_id);
  if(members.error)throw members.error;
  const users=new Set(members.data.map(member=>member.user_id));
  webpush.setVapidDetails(subject,publicKey,privateKey);
  let sent=0,failed=0,removed=0;
  // Small batches bound outgoing requests and invocation time.
  const targets=subscriptions.data;
  for(let offset=0;offset<targets.length;offset+=8)await Promise.all(targets.slice(offset,offset+8).map(async sub=>{
   if(row.status==='hold'&&!(Date.parse(row.hold_expires_at!)>Date.now()))return;
   if(!users.has(sub.user_id)||!allowedPushEndpoint(sub.endpoint)){
    const result=await db.from('push_subscriptions').delete().eq('id',sub.id);if(result.error)throw result.error;removed++;return;
   }
   const claim=await db.rpc('claim_booking_push_delivery',{p_event_key:eventId,p_subscription_id:sub.id});
   if(claim.error)throw claim.error;
   if(!claim.data){
    const receipt=await db.from('booking_push_deliveries').select('delivered_at').eq('event_key',eventId).eq('subscription_id',sub.id).maybeSingle();
    if(receipt.error)throw receipt.error;
    // A concurrent/crashed invocation is not a successful delivery. Preserve a
    // retryable response while its lease is pending or attempts are exhausted.
    if(!receipt.data?.delivered_at)failed++;
    return;
   }
   try{
    await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload,{TTL:row.status==='hold'?Math.min(900,Math.max(1,Math.floor((Date.parse(row.hold_expires_at!)-Date.now())/1000))):900,urgency:'high',timeout:8000});
    const result=await db.from('booking_push_deliveries').update({delivered_at:new Date().toISOString()}).eq('event_key',eventId).eq('subscription_id',sub.id);if(result.error)throw result.error;sent++;
   }catch(error){
    const status=(error as {statusCode?:number}).statusCode;
    if(status===404||status===410){const result=await db.from('push_subscriptions').delete().eq('id',sub.id);if(result.error)throw result.error;removed++;}
    else{
     failed++;
     const result=await db.from('booking_push_deliveries').update({locked_until:new Date().toISOString()}).eq('event_key',eventId).eq('subscription_id',sub.id);if(result.error)throw result.error;
     // No endpoints, keys, response bodies, or customer records in logs.
     console.error('[BookingPush] Delivery failed',{status:status||'network',eventId});
    }
   }
  }));
  return json({sent,failed,removed,eventId},failed?503:200);
 }catch(error){console.error('[BookingPush] Handler failed',{code:(error as {code?:string}).code||'internal'});return json({error:'Push processing failed; retry this webhook'},500);}
}
