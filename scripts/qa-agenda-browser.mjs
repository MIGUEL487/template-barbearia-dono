import {chromium} from 'playwright';import assert from 'node:assert/strict';
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {for(const width of [1440,390]){
 const context=await b.newContext({viewport:{width,height:900},timezoneId:'Asia/Tokyo'}),exp=Math.floor(Date.now()/1000)+3600;
 const user={id:'99999999-9999-4999-8999-999999999999',aud:'authenticated',role:'authenticated'};
 const access=[enc({alg:'HS256',typ:'JWT'}),enc({...user,exp}),enc('fixture')].join('.');
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+enc({access_token:access,refresh_token:'fixture',expires_at:exp,user}),domain:'127.0.0.1',path:'/'}]);
 const p=await context.newPage();await p.route('https://**.supabase.co/**',r=>r.abort());
 await p.goto('http://127.0.0.1:3005/agenda');await p.getByLabel('Data da agenda').fill('2026-10-29');
 await p.locator('[data-booking-id="nine"][data-agenda-time="09:00"]').waitFor();
 for(const [id,time] of [['nine','09:00'],['seventeen','17:00']]){const row=p.locator(`[data-booking-id="${id}"][data-agenda-time="${time}"]`);assert.match(await row.innerText(),/Pré-reserva \(hold\)/);assert(!/Disponível/.test(await row.innerText()));}
 assert.equal(await p.locator('[data-agenda-time="12:00"]').filter({hasText:'Almoço'}).count(),2);
 assert.equal(await p.getByText('1 atendimento em 29/10/2026',{exact:true}).count(),2);
 await p.reload();await p.getByLabel('Data da agenda').fill('2026-10-29');await p.locator('[data-booking-id="nine"]').first().waitFor();
 console.log({width,date:'29/10/2026',occupied:['Carlos 09:00','Jeronimo 17:00'],reload:true,timeZone:'Asia/Tokyo'});await context.close();
}}finally{await b.close()}
