import sharp from 'sharp';
import fs from 'node:fs/promises';
await fs.mkdir('public/pwa',{recursive:true});
for(const [name,size,fraction] of [['icon-192',192,.8],['icon-512',512,.8],['maskable-512',512,.64],['apple-180',180,.8]]){
 const logo=await sharp('public/brand/auto-stilo/logo-on-light.png').resize(Math.round(size*fraction),Math.round(size*fraction),{fit:'inside'}).png().toBuffer();
 await sharp({create:{width:size,height:size,channels:4,background:'#ffffff'}}).composite([{input:logo,gravity:'center'}]).png().toFile(`public/pwa/${name}.png`);
}
// Monochrome alpha badge for Android's notification status bar.
await sharp('public/brand/auto-stilo/logo-on-light.png').resize(96,96,{fit:'contain',background:'#00000000'}).threshold(128).png().toFile('public/pwa/badge-96.png');
