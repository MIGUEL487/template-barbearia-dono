export interface AgendaBooking {id:string; barber_id:string; starts_at:string; ends_at:string; status:string; hold_expires_at:string|null}
export interface WorkingHours {barber_id:string; day_of_week:number; start_time:string; end_time:string; lunch_start:string|null; lunch_end:string|null; is_off:boolean}
export interface TimeOff {barber_id:string; starts_at:string; ends_at:string; reason:string|null}
export const saoPauloDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
// Brazil has used UTC-03 throughout the supported modern booking calendar.
export function dayBounds(date:string){const start=new Date(`${date}T00:00:00-03:00`).getTime();return {start:new Date(start).toISOString(),end:new Date(start+86400000).toISOString()}}
export const weekday=(date:string)=>new Date(`${date}T12:00:00-03:00`).getUTCDay();
const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
const label=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const overlaps=(start:number,end:number,otherStart:string,otherEnd:string)=>start<Date.parse(otherEnd)&&end>Date.parse(otherStart);
export const isExpired=(b:AgendaBooking,now:number)=>b.status==='expired'||(b.status==='hold'&&!!b.hold_expires_at&&Date.parse(b.hold_expires_at)<=now);
export const blocks=(b:AgendaBooking,now:number)=>!isExpired(b,now)&&['hold','confirmed','completed'].includes(b.status);
export function agendaGrid<T extends AgendaBooking>(date:string,barberId:string,hours:WorkingHours[],bookings:T[],off:TimeOff[],closed:boolean,now:number){
 const wh=hours.find(h=>h.barber_id===barberId&&h.day_of_week===weekday(date));
 const bounds=dayBounds(date),midnight=Date.parse(bounds.start);
 const visible=bookings.filter(b=>b.barber_id===barberId&&!isExpired(b,now)&&overlaps(midnight,Date.parse(bounds.end),b.starts_at,b.ends_at));
 let start=wh?minutes(wh.start_time):0,end=wh?minutes(wh.end_time):30;
 // Keep bookings outside today's configured hours visible as well.
 for(const b of visible){start=Math.min(start,Math.max(0,Math.floor((Date.parse(b.starts_at)-midnight)/1800000)*30));end=Math.max(end,Math.min(1440,Math.ceil((Date.parse(b.ends_at)-midnight)/1800000)*30))}
 const rows=[];
 for(let minute=start;minute<end;minute+=30){
  const stop=Math.min(minute+30,end),from=midnight+minute*60000,to=midnight+stop*60000;
  const events=visible.filter(b=>overlaps(from,to,b.starts_at,b.ends_at));
  const absence=off.find(t=>t.barber_id===barberId&&overlaps(from,to,t.starts_at,t.ends_at));
  const state=closed?'Fechado':!wh?'Fechado':wh.is_off?'Folga':minute<minutes(wh.start_time)||stop>minutes(wh.end_time)?'Fechado':wh.lunch_start&&wh.lunch_end&&minute<minutes(wh.lunch_end)&&stop>minutes(wh.lunch_start)?'Almoço':absence?`Bloqueado${absence.reason?`: ${absence.reason}`:''}`:'Disponível';
  rows.push({time:label(minute),bookings:events,state,available:state==='Disponível'&&!events.some(b=>blocks(b,now))});
 }
 return rows;
}
