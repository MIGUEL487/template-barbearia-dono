// Local-only presentation QA. Requires both previews and the owner localhost fixture; never use a real Supabase project.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
const grid=async page=>page.evaluate(()=>{const errors=[];for(const e of document.querySelectorAll('body *')){const s=getComputedStyle(e);if(s.display==='none'||!e.getClientRects().length)continue;for(const p of ['paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','rowGap','columnGap']){const v=s[p];if(!v.endsWith('px')||v==='0px')continue;const n=parseFloat(v);if(Math.abs(n/8-Math.round(n/8))>.01)errors.push({tag:e.tagName,selector:e.className?.baseVal??e.className,property:p,value:v});}}return errors.slice(0,40)});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__motionCalls=0;const original=Element.prototype.animate;Element.prototype.animate=function(...args){window.__motionCalls++;return original.apply(this,args)};});
 for(const width of [360,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8787');await page.waitForLoadState('networkidle');await page.waitForTimeout(650);
  const bad=await grid(page);assert.deepEqual(bad,[],JSON.stringify(bad));
  assert.equal(await page.locator('video').count(),2);
  assert.equal(await page.locator('img[src*="/media/"]').count(),6);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.mp4')).length),0);
  assert(await page.evaluate(()=>window.__motionCalls>0));
  results.push({site:'cliente',width,grid:'pass',media:'pass'});
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8787');
 const film=page.locator('.shop-film').first();await film.scrollIntoViewIfNeeded();await film.getByRole('button',{name:'Reproduzir vídeo'}).click();await page.waitForFunction(()=>!document.querySelector('video').paused);
 await page.locator('#contato').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('video').paused);
 await page.goto('http://127.0.0.1:8787/agendar/');await page.waitForLoadState('networkidle');assert.deepEqual(await grid(page),[]);
 // Dynamic preference change must remove animation, not merely slow it down.
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:8787');await page.waitForLoadState('networkidle');
 assert.equal(await page.evaluate(()=>window.__motionCalls),0);
 assert.equal(await page.locator('.ambient-loop').evaluate(e=>getComputedStyle(e).animationName),'none');
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),uid='99999999-9999-4999-8999-999999999999',exp=Math.floor(Date.now()/1000)+3600;
 const token=[enc({alg:'HS256',typ:'JWT'}),enc({sub:uid,aud:'authenticated',role:'authenticated',exp}),enc('local-fixture')].join('.');
 await page.context().addCookies([{name:'sb-127-auth-token',value:'base64-'+enc({access_token:token,refresh_token:'local-fixture',expires_at:exp,user:{id:uid,aud:'authenticated',role:'authenticated'}}),domain:'127.0.0.1',path:'/'}]);
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});for(const route of ['dashboard','agenda','clientes','financeiro','servicos','equipe','configuracoes']){await page.goto('http://127.0.0.1:8788/'+route);await page.waitForLoadState('networkidle');await page.waitForTimeout(650);const bad=await grid(page);assert.deepEqual(bad,[],route+JSON.stringify(bad));results.push({site:'dono',route,width,grid:'pass'});}}
 assert.deepEqual(errors,[]);
 results.push({videoPlayAndOffscreenPause:'pass',reducedMotion:'pass',pageErrors:errors});
 await fs.writeFile('docs/media-motion/interactions.json',JSON.stringify(results,null,2));console.log('Media, 8px computed spacing, motion and video interactions passed');
}finally{await browser.close()}
