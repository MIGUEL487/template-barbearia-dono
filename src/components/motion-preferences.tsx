"use client";
import {createContext,useContext,useEffect,useState} from "react";
import {MotionConfig} from "motion/react";
import {InterfaceMotion} from "./interface-motion";
const MotionContext=createContext(true);
export const useMotionEnabled=()=>useContext(MotionContext);
export function MotionPreferences({children}:{children:React.ReactNode}){
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion:reduce)');const read=()=>{const forced=new URLSearchParams(location.search).get('motion');let saved=null;try{saved=localStorage.getItem('auto-stilo-motion')}catch{}const value=forced==='full'?true:forced==='off'?false:saved!==null?saved==='on':!mq.matches;setEnabled(value);document.documentElement.classList.toggle('motion-off',!value)};read();mq.addEventListener('change',read);window.addEventListener('auto-stilo-motion',read);return()=>{mq.removeEventListener('change',read);window.removeEventListener('auto-stilo-motion',read)}},[]);
 return <MotionContext.Provider value={enabled}><MotionConfig reducedMotion={enabled?'never':'always'}>{enabled&&<InterfaceMotion/>}{children}</MotionConfig></MotionContext.Provider>;
}
export function MotionToggle(){const enabled=useMotionEnabled();return <button type="button" aria-pressed={enabled} onClick={()=>{try{localStorage.setItem('auto-stilo-motion',enabled?'off':'on')}catch{}window.dispatchEvent(new Event('auto-stilo-motion'))}}>Animações: {enabled?'ativadas':'reduzidas'}</button>}
