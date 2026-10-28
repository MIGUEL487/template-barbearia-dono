import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code=ts.transpile(fs.readFileSync('src/lib/agenda-grid.ts','utf8'),{module:ts.ModuleKind.CommonJS});
const api={};new Function('exports',code)(api);
const date='2026-10-29',now=Date.parse('2026-10-29T11:00:00Z');
const carlos='22222222-2222-2222-2222-222222222221',jeronimo='22222222-2222-2222-2222-222222222222';
const hours=[carlos,jeronimo].map(barber_id=>({barber_id,day_of_week:4,start_time:'09:00:00',end_time:'19:00:00',lunch_start:'12:00:00',lunch_end:'13:00:00',is_off:false}));
const bookings=[{id:'nine',barber_id:carlos,starts_at:'2026-10-29T12:00:00+00:00',ends_at:'2026-10-29T12:45:00+00:00',status:'hold',hold_expires_at:'2026-10-29T11:15:00Z'},{id:'seventeen',barber_id:jeronimo,starts_at:'2026-10-29T20:00:00+00:00',ends_at:'2026-10-29T21:00:00+00:00',status:'hold',hold_expires_at:'2026-10-29T11:15:00Z'}];
for(const id of [carlos,jeronimo]){
 const rows=api.agendaGrid(date,id,hours,bookings,[],false,now),time=id===carlos?'09:00':'17:00';
 assert.equal(rows[0].time,'09:00');assert(!rows.some(r=>r.time==='08:00'));assert.equal(rows.find(r=>r.time===time).available,false);
 assert.equal(rows.find(r=>r.time===time).bookings.length,1);assert.equal(rows.find(r=>r.time==='12:00').state,'Almoço');assert.equal(rows.find(r=>r.time==='12:30').available,false);
 const expired=api.agendaGrid(date,id,hours,bookings,[],false,now+1800000);assert.equal(expired.find(r=>r.time===time).available,true);
}
assert.equal(api.agendaGrid(date,carlos,hours,bookings,[],false,now).find(r=>r.time==='09:30').bookings.length,1);
assert.equal(api.agendaGrid(date,carlos,hours,bookings,[],false,now).find(r=>r.time==='10:00').bookings.length,0);
const cancellation=bookings.map(b=>({...b,status:'cancelled'}));assert.equal(api.agendaGrid(date,carlos,hours,cancellation,[],false,now)[0].available,true);
assert(api.agendaGrid(date,carlos,hours,bookings,[],true,now).every(r=>!r.available));
assert(api.agendaGrid(date,carlos,hours.map(h=>({...h,is_off:true})),[],[],false,now).every(r=>r.state==='Folga'));
const off=[{barber_id:carlos,starts_at:'2026-10-29T18:15:00Z',ends_at:'2026-10-29T19:00:00Z',reason:'Bloqueio'}];
assert.equal(api.agendaGrid(date,carlos,hours,[],off,false,now).find(r=>r.time==='15:00').available,false);
assert.equal(api.dayBounds(date).start,'2026-10-29T03:00:00.000Z');assert.equal(api.dayBounds(date).end,'2026-10-30T03:00:00.000Z');
assert.equal(api.saoPauloDate(new Date('2026-10-30T01:00:00Z')),date);
const midnight=[{...bookings[0],starts_at:'2026-10-29T02:45:00Z',ends_at:'2026-10-29T03:30:00Z'}];assert.equal(api.agendaGrid(date,carlos,[],midnight,[],false,now)[0].bookings.length,1);
console.log('PASS: 29/10 Carlos 09:00 + Jeronimo 17:00, overlap, lunch, expiry, cancellation, closure, day off, time off, cross-midnight, São Paulo day bounds.');
