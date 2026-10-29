// Local pre-rendered Next pages + intercepted Supabase/PushManager/Realtime.
// No real subscription or database write; OS delivery still needs device testing.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),shop='11111111-1111-1111-1111-111111111111',uid='99999999-9999-4999-8999-999999999999',barber='22222222-2222-2222-2222-222222222221';
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const relative=pathname.startsWith('/_next/')?`.next/static/${pathname.slice('/_next/static/'.length)}`:pathname==='/agenda'||pathname==='/configuracoes'?`.next/server/app${pathname}.html`:`public${pathname}`;
  const file=path.resolve(root,relative);if(!file.startsWith(root+'/'))throw new Error('path');
  const data=await fs.readFile(file),ext=path.extname(file);
  res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'})[ext]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
await fs.mkdir('docs/notifications',{recursive:true});
const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:900},permissions:['notifications']});
 const exp=Math.floor(Date.now()/1000)+3600,user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.test'};
 const access=[enc({alg:'HS256',typ:'JWT'}),enc({...user,sub:uid,exp}),enc('fixture')].join('.');
 await context.addCookies([{name:'sb-jrzabortkpouqkwndpcq-auth-token',value:'base64-'+enc({access_token:access,refresh_token:'fixture',expires_at:exp,user}),url:base}]);
 await context.addInitScript(()=>{
  window.__qa={permissionRequests:0,plays:0,subscribed:false};let permission=localStorage.getItem('qa-denied')?'denied':'default',subscription=null;
  Object.defineProperty(Notification,'permission',{get:()=>permission});
  Notification.requestPermission=async()=>{window.__qa.permissionRequests++;permission='granted';return permission;};
  HTMLMediaElement.prototype.play=function(){window.__qa.plays++;return Promise.resolve();};
  PushManager.prototype.getSubscription=async()=>subscription;
  PushManager.prototype.subscribe=async function(options){
   window.__qa.subscribed=true;subscription={endpoint:'https://fcm.googleapis.com/fcm/send/local-fixture',options,unsubscribe:async()=>{subscription=null;window.__qa.subscribed=false;return true;},toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/local-fixture',keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}})};return subscription;
  };
 });
 const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-10-29T12:00:00Z'));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let rows=[],saved=null,gridReads=0,wire,topic,joinRef,arrayProtocol=true,releaseBootstrap;
 const bootstrap=new Promise(resolve=>releaseBootstrap=resolve);
 await page.route('https://*.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),single=(req.headers().accept||'').includes('object');let data=[];
  if(table==='user')data=user;
  if(table==='shop_members')data=single?{barbershop_id:shop,role:'owner'}:[{barbershop_id:shop,user_id:uid,role:'owner'}];
  if(table==='barbers'){await bootstrap;data=[{id:barber,name:'Carlos'}];}
  if(table==='services')data=[{id:'33333333-3333-3333-3333-333333333331',name:'Corte',price:60,duration_minutes:30}];
  if(table==='working_hours')data=[{barber_id:barber,day_of_week:4,start_time:'09:00',end_time:'19:00',lunch_start:'12:00',lunch_end:'13:00',is_off:false}];
  if(table==='site_settings')data={brand_name:'Auto Stilo'};
  if(table==='bookings'){if(url.searchParams.has('starts_at'))gridReads++;const joined=rows.map(row=>({...row,barbers:{name:'Carlos'},booking_items:[{service_name:'Corte'}]}));data=single?joined[0]||null:joined;}
  if(table==='push_subscriptions'){
   if(req.method()==='POST'){saved={...req.postDataJSON(),id:'fixture-sub'};data=null;}
   else if(req.method()==='DELETE'){saved=null;data=null;}
   else data=single?saved:saved?[saved]:[];
  }
  await route.fulfill({json:data});
 });
 await page.routeWebSocket(/supabase\.co\/realtime\//,socket=>{
  wire=socket;socket.onMessage(message=>{
   if(typeof message!=='string')return;
   const raw=JSON.parse(message);arrayProtocol=Array.isArray(raw);
   const [jr,ref,t,event,payload]=arrayProtocol?raw:[raw.join_ref,raw.ref,raw.topic,raw.event,raw.payload];
   const send=(name,data)=>socket.send(JSON.stringify(arrayProtocol?[jr,ref,t,name,data]:{join_ref:jr,ref,topic:t,event:name,payload:data}));
   if(event==='phx_join'){topic=t;joinRef=jr;send('phx_reply',{status:'ok',response:{postgres_changes:payload.config.postgres_changes.map(filter=>({...filter,id:1}))}});}
   else if(event==='heartbeat'||event==='phx_leave')send('phx_reply',{status:'ok',response:{}});
  });
 });
 await page.goto(base+'/agenda');
 await page.locator('.admin-skeleton').waitFor();
 assert.equal((await page.locator('.admin-skeleton').innerText()).trim(),'');
 assert.deepEqual(await page.locator('.admin-skeleton img').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})),{width:96,height:96});
 await page.locator('.admin-skeleton').screenshot({path:`docs/notifications/loading-logo-${width}.png`});
 releaseBootstrap();
 await page.getByText('Agenda conectada em tempo real.',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>window.__qa.permissionRequests),0);
 await page.getByRole('button',{name:'Ativar notificações',exact:true}).click();
 await page.getByRole('button',{name:'Desativar neste aparelho',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__qa.permissionRequests),1);assert.equal(saved.barbershop_id,shop);assert.equal(saved.user_id,uid);
 await page.getByRole('button',{name:'Ativar som',exact:true}).click();
 await page.getByRole('button',{name:'Silenciar',exact:true}).waitFor();
 const before=gridReads,plays=await page.evaluate(()=>window.__qa.plays);
 const booking={id:'44444444-4444-4444-4444-444444444444',barbershop_id:shop,barber_id:barber,status:'hold',starts_at:'2026-10-29T12:00:00Z',ends_at:'2026-10-29T12:30:00Z',hold_expires_at:'2099-01-01T00:00:00Z',created_at:'2026-10-29T12:00:00Z',updated_at:'2026-10-29T12:00:00Z',total_price:60,booking_items:[{service_name:'Corte'}],customers:{name:'Pré-reserva',phone:''}};
 rows=[booking];
 const emit=()=>{const payload={ids:[1],data:{schema:'public',table:'bookings',type:'INSERT',commit_timestamp:'2026-10-29T12:00:00Z',record:booking,old_record:{},columns:[]}};wire.send(JSON.stringify(arrayProtocol?[joinRef,null,topic,'postgres_changes',payload]:{join_ref:joinRef,ref:null,topic,event:'postgres_changes',payload}));};
 emit();await page.getByRole('heading',{name:'Nova pré-reserva',exact:true}).waitFor();
 assert.match(await page.getByRole('status').filter({hasText:'Nova pré-reserva'}).innerText(),/Carlos/);
 await page.locator('[data-booking-id="44444444-4444-4444-4444-444444444444"]').first().waitFor();
 assert(gridReads>before,'agenda must refresh without navigation');assert.equal(await page.evaluate(()=>window.__qa.plays),plays+1);
 emit();await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.__qa.plays),plays+1,'duplicate event must not replay sound');
 assert(!/telefone|119999/.test(await page.getByRole('status').filter({hasText:'Nova pré-reserva'}).innerText()));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`docs/notifications/agenda-${width}.png`,fullPage:true});
 const cdp=await context.newCDPSession(page);
 const registrationReady=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('worker registration missing')),5000);cdp.on('ServiceWorker.workerRegistrationUpdated',({registrations})=>{const registration=registrations.find(item=>item.scopeURL===base+'/');if(registration){clearTimeout(timer);resolve(registration.registrationId);}});});
 await cdp.send('ServiceWorker.enable');const registrationId=await registrationReady;
 const eventId=createHash('sha256').update(JSON.stringify([booking.id,booking.status,new Date(booking.starts_at).toISOString(),new Date(booking.ends_at).toISOString(),booking.barber_id,new Date(booking.updated_at).toISOString()])).digest('hex');
 const data=JSON.stringify({eventId,title:'Nova pré-reserva',body:'Carlos · Corte · 29/10/2026, 09:00 (Brasília)'});
 await cdp.send('ServiceWorker.deliverPushMessage',{origin:base,registrationId,data});
 await page.waitForFunction(async()=>{const registration=await navigator.serviceWorker.getRegistration('/');return (await registration.getNotifications()).length===1;});
 await cdp.send('ServiceWorker.deliverPushMessage',{origin:base,registrationId,data});
 await page.waitForTimeout(200);
 assert.equal(await page.evaluate(async()=>(await(await navigator.serviceWorker.getRegistration('/')).getNotifications()).length),1);
 assert.equal(await page.evaluate(()=>window.__qa.plays),plays+1,'push + Realtime must not duplicate the sound');
 await page.getByRole('button',{name:'Desativar neste aparelho',exact:true}).click();await page.getByRole('button',{name:'Ativar notificações',exact:true}).waitFor();assert.equal(saved,null);assert.equal(await page.evaluate(()=>window.__qa.subscribed),false);
 const registration=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return {active:!!r?.active,script:r?.active?.scriptURL};});assert(registration.active);assert(registration.script.endsWith('/booking-push-sw.js'));
 assert.deepEqual(errors,[]);console.log({width,explicitPermission:true,subscriptionSaved:true,realtimeRefresh:true,sound:true,deduplication:true,workerPushEvent:true,unsubscribe:true});
 await page.goto(base+'/configuracoes');await page.getByRole('button',{name:'Ativar notificações',exact:true}).waitFor();
 await page.getByRole('button',{name:'Reativar som neste acesso',exact:true}).click();await page.getByRole('button',{name:'Silenciar',exact:true}).waitFor();
 await page.screenshot({path:`docs/notifications/configuracoes-${width}.png`,fullPage:true});
 await page.evaluate(()=>localStorage.setItem('qa-denied','1'));await page.reload();
 await page.getByText(/Permissão bloqueada\./).waitFor();assert(await page.getByRole('button',{name:'Ativar notificações',exact:true}).isDisabled());assert.equal(await page.evaluate(()=>window.__qa.permissionRequests),0);
 if(width===390){
  await page.evaluate(()=>localStorage.removeItem('qa-denied'));
  await context.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'}));
  await page.reload();await page.getByText(/No iPhone\/iPad, abra no Safari/).waitFor();assert(await page.getByRole('button',{name:'Ativar notificações',exact:true}).isDisabled());
  await page.screenshot({path:'docs/notifications/iphone-install-instructions.png',fullPage:true});
 }
 console.log({width,savedSoundPreference:true,deniedPermission:true,iphoneInstallInstructions:width===390});
 await context.close();
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
