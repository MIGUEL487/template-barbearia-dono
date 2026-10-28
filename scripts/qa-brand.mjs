// Local OpenNext preview + localhost fixture only; no real sign-in or database writes.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:8788';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local preview required');
const root='docs/logo-auto-stilo';await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const user={id:'99999999-9999-4999-8999-999999999999',aud:'authenticated',role:'authenticated'},exp=Math.floor(Date.now()/1000)+3600;
const access=[enc({alg:'HS256',typ:'JWT'}),enc({...user,exp}),enc('local-fixture')].join('.');
try{
 for(const [width,height] of [[1440,900],[1366,768],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768});
  const page=await context.newPage(),errors=[];let remote=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  // Catch any accidental production backend access before it can leave the browser.
  await page.route('https://**.supabase.co/**',r=>{remote++;return r.abort()});
  await page.goto(`${base}/login`);await page.waitForLoadState('networkidle');await page.waitForTimeout(600);
  const login=await page.locator('.login-logo').evaluate(i=>({src:i.getAttribute('src'),width:i.clientWidth,height:i.clientHeight,radius:getComputedStyle(i).borderRadius,background:getComputedStyle(i.parentElement).backgroundColor}));
  assert.equal(login.src,'/brand/auto-stilo/logo-on-light.png');assert.equal(login.width,56);assert.equal(login.radius,'0px');
  const icons=await page.locator('link[rel=icon]').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),type:e.type,media:e.getAttribute('media')})));
  assert(!icons.some(i=>i.href.includes('marca-203')||i.href.startsWith('/icon.png')));assert(icons.some(i=>i.href==='/favicon-dono-branco.svg'));
  for(const icon of icons){const res=await page.request.get(base+icon.href);assert(res.ok(),icon.href)}
  await page.screenshot({path:`${root}/${width}-login.jpg`,type:'jpeg',quality:88});
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+enc({access_token:access,refresh_token:'local-fixture',expires_at:exp,user}),domain:'127.0.0.1',path:'/'}]);
  await page.goto(`${base}/dashboard`);await page.waitForLoadState('networkidle');await page.waitForTimeout(1000);
  assert(new URL(page.url()).pathname==='/dashboard','Dashboard requires the local fixture build/runtime');
  const selector=width<768?'.admin-mobile-brand':'.admin-brand';
  await page.locator(selector).waitFor({state:'visible'});
  const nav=await page.locator(`${selector} img`).evaluate(i=>({src:i.getAttribute('src'),width:i.clientWidth,height:i.clientHeight,radius:getComputedStyle(i).borderRadius,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  assert.equal(nav.src,'/brand/auto-stilo/logo-on-light.png');assert.equal(nav.width,48);assert.equal(nav.radius,'0px');assert.equal(nav.overflow,0);
  await page.mouse.wheel(0,200);await page.waitForTimeout(400);await page.mouse.wheel(0,-200);await page.waitForTimeout(500);
  await page.screenshot({path:`${root}/${width}-dashboard.jpg`,type:'jpeg',quality:88});
  assert.equal(remote,0,'Real backend access attempted');assert.equal(errors.length,0,errors.join('\n'));
  results.push({width,height,login,nav,icons,remote,errors});await context.close();
 }
 for(const scheme of ['light','dark']){
  const p=await browser.newPage({viewport:{width:900,height:460},colorScheme:scheme});await p.goto(`${base}/login`);await p.waitForLoadState('networkidle');
  await p.setContent(`<body style="margin:0;background:${scheme==='dark'?'#0a0a0c':'#fff'};color:${scheme==='dark'?'white':'black'};font:16px sans-serif;padding:32px;display:flex;align-items:center;gap:48px"><img src="${base}/brand/auto-stilo/logo-on-${scheme}.png" width="288"><div><p>Favicon · ${scheme}</p><div style="display:flex;align-items:center;gap:32px">${[16,32,48,96].map(n=>`<img class="icon" src="${base}/favicon-dono-branco.svg" width="${n}" height="${n}">`).join('')}</div></div></body>`);
  await p.locator('.icon').last().evaluate(i=>i.decode());
  const pixels=await p.locator('.icon').last().evaluate(img=>{const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,96,96);const d=ctx.getImageData(0,0,96,96).data;let ink=0,sum=0,clear=0,purple=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<20){clear++;continue}if(d[i+3]<180)continue;const[r,g,b]=d.slice(i,i+3);if(b>g+15&&r>g+5){purple++;continue}ink++;sum+=(r+g+b)/3}return{brightness:sum/ink,clear,purple}});
  assert(pixels.clear>96*96*.3&&pixels.purple>0);assert(pixels.brightness>220,'Owner favicon must stay white');
  await p.screenshot({path:`${root}/marca-e-favicon-${scheme}.png`});results.push({scheme,pixels});await p.close();
 }
 if(process.env.REFERENCE_REPO){
  const files=['assets/brand/auto-stilo-on-light.png','assets/brand/auto-stilo-on-dark.png','public/apple-touch-icon.png',...(await fs.readdir('public/brand/auto-stilo')).map(f=>'public/brand/auto-stilo/'+f)];
  const hashes=[];for(const file of files){const a=await fs.readFile(file),b=await fs.readFile(path.join(process.env.REFERENCE_REPO,file));assert(a.equals(b),`Different brand asset: ${file}`);hashes.push({file,sha256:crypto.createHash('sha256').update(a).digest('hex')})}results.push({sameAssetsInBothRepositories:true,hashes});
 }
 await fs.writeFile(`${root}/results.json`,JSON.stringify(results,null,2));console.log('Login, navigation, both favicon themes and shared asset hashes passed.');
}finally{await browser.close()}
