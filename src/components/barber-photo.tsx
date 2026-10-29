"use client";
import Image from 'next/image';
import {useState} from 'react';
import {UserRound} from 'lucide-react';
export function BarberPhoto({url,name,className=''}:{url:string|null;name:string;className?:string}){
 const [failed,setFailed]=useState<string|null>(null);
 let source:string|null=null;
 if(url){const value=url.trim();try{if(value.startsWith('/')&&!value.startsWith('//'))source=value;else if(['https:','blob:'].includes(new URL(value).protocol))source=value}catch{}}
 return <span className={'barber-photo '+className}>
  {source&&failed!==source?<Image src={source} alt={'Foto de '+name} width={64} height={64} unoptimized onError={()=>setFailed(source)}/>:<UserRound aria-label={'Foto de '+name+' não cadastrada ou indisponível'} size={24}/>}
 </span>;
}
