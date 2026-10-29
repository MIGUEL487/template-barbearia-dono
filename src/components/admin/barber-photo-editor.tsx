"use client";
import {useState} from 'react';
import {BarberPhoto} from '@/components/barber-photo';
import {updateBarberPhotoAction} from '@/app/actions/admin-actions';
export function BarberPhotoEditor({shopId,barber,onSaved}:{shopId:string;barber:{id:string;name:string;avatar_url:string|null};onSaved:()=>Promise<void>}){
 const [url,setUrl]=useState(barber.avatar_url||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(value:string){setBusy(true);setError('');try{const result=await updateBarberPhotoAction(shopId,barber.id,value);if(!result.success){setError(result.error||'Não foi possível salvar a foto.');return}await onSaved()}catch{setError('Não foi possível salvar a foto. Tente novamente.')}finally{setBusy(false)}}
 return <details className="barber-photo-editor" onClick={e=>e.stopPropagation()}><summary>Alterar foto</summary><form onSubmit={e=>{e.preventDefault();void save(url)}} className="space-y-4">
  <BarberPhoto url={url.trim().startsWith('https://')?url.trim():null} name={barber.name}/>
  <label className="field-label">Link da foto<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…" maxLength={2048} disabled={busy}/></label>
  <p className="text-xs text-text-muted">Use o link HTTPS de uma imagem pública. A foto aparecerá na escolha de profissionais do site do cliente.</p>
  {error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap gap-4"><button type="submit" disabled={busy} className="bg-accent text-white px-4 py-2 rounded-full">{busy?'Salvando…':'Salvar foto'}</button><button type="button" disabled={busy||!barber.avatar_url} onClick={()=>void save('')}>Remover foto</button></div>
 </form></details>;
}
