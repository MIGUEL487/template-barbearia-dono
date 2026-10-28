// Servidor exclusivamente local para QA; nunca se conecta ao Supabase real.
const http=require('node:http');
const uid='99999999-9999-4999-8999-999999999999',shop='11111111-1111-1111-1111-111111111111';
const barbers=[{id:'22222222-2222-2222-2222-222222222221',name:'Carlos'},{id:'22222222-2222-2222-2222-222222222222',name:'Jeronimo'}];
const user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.test'};
http.createServer((req,res)=>{
 res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*');res.setHeader('content-type','application/json');
 if(req.method==='OPTIONS'){res.end();return}
 const url=new URL(req.url,'http://localhost'),table=url.pathname.split('/').pop();
 const weekday=Number(url.searchParams.get('day_of_week')?.slice(3)||4);
 const data=table==='user'?user:table==='shop_members'?{barbershop_id:shop,role:'owner'}:table==='barbers'?barbers:table==='services'?[{id:'33333333-3333-3333-3333-333333333331',name:'Corte',price:60,duration_minutes:45}]:table==='working_hours'?barbers.map(b=>({barber_id:b.id,day_of_week:weekday,start_time:'09:00:00',end_time:'19:00:00',lunch_start:'12:00:00',lunch_end:'13:00:00',is_off:weekday===0})):table==='bookings'&&url.searchParams.get('starts_at')?.includes('2026-10-30')?barbers.map((b,i)=>({id:i?'seventeen':'nine',barber_id:b.id,starts_at:`2026-10-29T${i?'20':'12'}:00:00Z`,ends_at:`2026-10-29T${i?'20':'12'}:45:00Z`,hold_expires_at:'2099-01-01T00:00:00Z',status:'hold',total_price:60,customers:{name:i?'Cliente 17':'Cliente 09',phone:''},booking_items:[{service_name:'Corte'}]})):[];
 res.end(JSON.stringify(data));
}).listen(54331,'127.0.0.1',()=>console.log('Local agenda fixture:54331'));
