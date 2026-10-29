// Usa apenas o backend local photo-fixture.cjs; retrato SVG é ilustrativo.
import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const photo='https://photo-fixture.example/portrait.svg';
const owner=process.env.QA_OWNER_URL||'http://127.0.0.1:3006';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#efedf4"/><circle cx="80" cy="58" r="28" fill="#433e4d"/><path d="M24 160v-20a56 56 0 0 1 112 0v20" fill="#a78bfa"/></svg>';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
await fs.mkdir('docs/barber-photos',{recursive:true});await fs.mkdir('../template-barbearia-cliente/docs/barber-photos',{recursive:true});
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:900}}),exp=Math.floor(Date.now()/1000)+3600;
 const user={id:'99999999-9999-4999-8999-999999999999',aud:'authenticated',role:'authenticated'};
 const access=[enc({alg:'HS256',typ:'JWT'}),enc({...user,exp}),enc('fixture')].join('.');
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+enc({access_token:access,refresh_token:'fixture',expires_at:exp,user}),domain:'127.0.0.1',path:'/'}]);
 await context.route('https://photo-fixture.example/**',r=>r.request().url()===photo?r.fulfill({contentType:'image/svg+xml',body:svg}):r.fulfill({status:404,body:''}));
 await context.route('https://*.supabase.co/**',async r=>{const url=new URL(r.request().url());const response=await fetch('http://127.0.0.1:54332'+url.pathname+url.search);await r.fulfill({json:await response.json()})});
 const p=await context.newPage();await p.goto(owner+'/equipe');
 const editor=p.locator('.barber-photo-editor').first();await editor.locator('summary').click();await editor.getByLabel('Link da foto').fill(photo);
 await editor.getByRole('button',{name:'Salvar foto'}).click();
 await p.waitForFunction(async photo=>{const data=await fetch('http://127.0.0.1:54332/rest/v1/public_barbers').then(r=>r.json());return data[0].avatar_url===photo},photo);
 await p.getByRole('img',{name:'Foto de Carlos'}).first().waitFor();await p.reload();await editor.locator('summary').click();await editor.getByLabel('Link da foto').fill(photo);await editor.getByRole('img',{name:'Foto de Carlos'}).evaluate(i=>i.decode());
 await editor.locator('..').screenshot({path:`docs/barber-photos/${width}-owner.jpg`});
 await editor.getByLabel('Link da foto').fill('http://insecure.example/photo.jpg');await editor.getByRole('button',{name:'Salvar foto'}).click();await editor.getByRole('alert').waitFor();assert.match(await editor.getByRole('alert').innerText(),/HTTPS/);
 const client=await context.newPage();await client.goto('http://localhost:8787/agendar');const img=client.getByRole('img',{name:'Foto de Carlos',exact:true});await img.evaluate(i=>i.decode());assert.equal(await img.getAttribute('src'),photo);assert(await client.getByRole('radio',{name:/Carlos/}).count());
 await client.screenshot({path:`../template-barbearia-cliente/docs/barber-photos/${width}-client.jpg`,fullPage:true});
 await editor.getByRole('button',{name:'Remover foto'}).click();await p.waitForFunction(async()=>{const data=await fetch('http://127.0.0.1:54332/rest/v1/public_barbers').then(r=>r.json());return data[0].avatar_url===null});await client.reload();await client.getByRole('radio',{name:/Carlos/}).waitFor();await client.getByRole('img',{name:'Foto de Carlos',exact:true}).waitFor({state:'detached'});assert.equal(await client.getByRole('img',{name:'Foto de Carlos',exact:true}).count(),0);
 console.log({width,save:true,clientReadsSamePhoto:true,httpsValidation:true,remove:true});await context.close();
}}finally{await browser.close()}
