"use client";
import {createContext,useContext,useEffect,useState} from "react";
import {MotionConfig} from "motion/react";
import {InterfaceMotion} from "./interface-motion";
const MotionContext=createContext(true);
export const useMotionEnabled=()=>useContext(MotionContext);
export function MotionPreferences({children}:{children:React.ReactNode}){
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion:reduce)');const read=()=>{const forced=new URLSearchParams(location.search).get('motion');let saved=null;try{saved=localStorage.getItem('auto-stilo-motion')}catch{}const value=forced==='full'?true:forced==='off'?false:saved!==null?saved==='on':!mq.matches;setEnabled(value);document.documentElement.classList.toggle('motion-off',!value)};read();const visibility=()=>document.documentElement.classList.toggle('page-hidden',document.hidden);visibility();document.addEventListener('visibilitychange',visibility);mq.addEventListener('change',read);window.addEventListener('auto-stilo-motion',read);return()=>{document.removeEventListener('visibilitychange',visibility);mq.removeEventListener('change',read);window.removeEventListener('auto-stilo-motion',read)}},[]);
 return <MotionContext.Provider value={enabled}><MotionConfig reducedMotion={enabled?'never':'always'}>{enabled&&<InterfaceMotion/>}{children}</MotionConfig></MotionContext.Provider>;
}
export function MotionToggle() {
  const enabled = useMotionEnabled();
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => {
        try {
          localStorage.setItem("auto-stilo-motion", enabled ? "off" : "on");
        } catch {}
        window.dispatchEvent(new Event("auto-stilo-motion"));
      }}
      className="text-[11px] font-medium text-text-muted hover:text-text bg-surface-2 hover:bg-surface-3 border border-hairline px-3 py-1.5 rounded-lg w-full flex items-center justify-between transition-colors !min-h-0"
    >
      <span>Animações</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${enabled ? "bg-accent/20 text-accent-light" : "bg-surface text-text-muted"}`}>
        {enabled ? "Ativadas" : "Reduzidas"}
      </span>
    </button>
  );
}
