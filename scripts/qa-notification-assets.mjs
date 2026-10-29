// Run against local OpenNext/Wrangler preview, never production.
import assert from 'node:assert/strict';
import sharp from 'sharp';
const base='http://127.0.0.1:8788';
for(const file of ['/booking-push-sw.js','/manifest.webmanifest','/pwa/icon-192.png','/pwa/maskable-512.png','/sounds/prim.mp3']){
 const response=await fetch(base+file,{redirect:'manual'});assert.equal(response.status,200,file);
 if(file.endsWith('sw.js')){
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(response.headers.get('service-worker-allowed'),'/');
  const code=await response.text();assert(!/addEventListener\(['"]fetch['"]/.test(code));assert(!/caches\.(open|match|put)/.test(code));
 }
 if(file.endsWith('webmanifest')){
  const manifest=await response.json();assert.equal(manifest.name,'Auto Stilo - Gestão');assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/agenda');
 }
 console.log(file,response.status,response.headers.get('content-type'));
}
for(const size of [192,512]){const metadata=await sharp(`public/pwa/icon-${size}.png`).metadata();assert.equal(metadata.width,size);assert.equal(metadata.height,size);}
const agenda=await fetch(base+'/agenda',{redirect:'manual'});assert.equal(agenda.status,307);assert(new URL(agenda.headers.get('location'),base).pathname==='/login');
console.log('PWA assets public, no offline fetch/cache, worker no-store, protected agenda still requires login.');
