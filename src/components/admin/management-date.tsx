'use client';
import {useEffect,useState} from 'react';
export function ManagementDate(){const [label,setLabel]=useState('Calendário da equipe');useEffect(()=>setLabel(new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'America/Sao_Paulo'}).format(new Date())),[]);return <span>{label}</span>}
