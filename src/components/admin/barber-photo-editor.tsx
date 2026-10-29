"use client";
import {useEffect,useState} from 'react';
import {AnimatePresence,motion} from 'motion/react';
import {useMotionEnabled} from '@/components/motion-preferences';
import {BarberPhoto} from '@/components/barber-photo';
import {updateBarberPhotoAction,uploadBarberPhotoAction} from '@/app/actions/admin-actions';
import {prepareBarberPhoto} from '@/lib/prepare-barber-photo';
export function BarberPhotoEditor({shopId,barber,onSaved}:{shopId:string;barber:{id:string;name:string;avatar_url:string|null};onSaved:()=>Promise<void>}){
 const [url,setUrl]=useState(barber.avatar_url||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<string|null>(null),[preparing,setPreparing]=useState(false),[open,setOpen]=useState(false);const motionEnabled=useMotionEnabled();
 useEffect(()=>{if(!file){setPreview(null);return}const local=URL.createObjectURL(file);setPreview(local);return()=>URL.revokeObjectURL(local)},[file]);
 async function save(value:string,remove=false){setBusy(true);setError('');try{let result;if(file&&!remove){const form=new FormData();form.set('photo',file);result=await uploadBarberPhotoAction(shopId,barber.id,form)}else result=await updateBarberPhotoAction(shopId,barber.id,value);if(!result.success){setError(result.error||'Não foi possível salvar a foto.');return}await onSaved()}catch{setError('Não foi possível salvar a foto. Tente novamente.')}finally{setBusy(false)}}
 return <details className="barber-photo-editor" onClick={e=>e.stopPropagation()} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Alterar foto</summary><motion.form initial={false} animate={{opacity:open?1:0,y:open?0:motionEnabled?8:0}} transition={{duration:motionEnabled?0.25:0}} onSubmit={e=>{e.preventDefault();void save(url)}} className="space-y-4">
  <BarberPhoto url={preview||url.trim()} name={barber.name}/>
  <label className="field-label">Enviar foto do dispositivo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||preparing} onChange={async e=>{const selected=e.target.files?.[0];if(!selected)return;setPreparing(true);setError('');setFile(null);try{setFile(await prepareBarberPhoto(selected));setUrl('')}catch(err){setError(err instanceof Error?err.message:'Não foi possível preparar a foto.')}finally{setPreparing(false)}}}/></label>
  {preparing&&<p role="status">Preparando foto…</p>}
  <label className="field-label">Ou link da foto<input type="url" value={url} onChange={e=>{setUrl(e.target.value);setFile(null)}} placeholder="https://…" maxLength={2048} disabled={busy||preparing}/></label>
  <p className="text-xs text-text-muted">Escolha uma foto de Downloads, da galeria ou use um link HTTPS público. Ela aparecerá no site do cliente.</p>
  <AnimatePresence>{error&&<motion.p role="alert" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>{error}</motion.p>}</AnimatePresence>
  <div className="flex flex-wrap gap-4"><button type="submit" disabled={busy||preparing} className="bg-accent text-white px-4 py-2 rounded-full">{busy?'Salvando…':'Salvar foto'}</button><button type="button" disabled={busy||preparing||!barber.avatar_url} onClick={()=>void save('',true)}>Remover foto</button></div>
 </motion.form></details>;
}
