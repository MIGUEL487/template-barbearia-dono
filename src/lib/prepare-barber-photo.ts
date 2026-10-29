export async function prepareBarberPhoto(file:File):Promise<File>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Escolha uma foto JPG, PNG ou WebP de até 10 MB.');
 const image=await createImageBitmap(file);
 try{const ratio=Math.min(1,1024/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto.');ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível preparar a foto.')),'image/webp',.82));
 if(blob.size>800*1024)throw new Error('A foto ainda está muito grande. Escolha uma imagem menor.');
 return new File([blob],'profissional.webp',{type:blob.type});
 }finally{image.close()}
}
