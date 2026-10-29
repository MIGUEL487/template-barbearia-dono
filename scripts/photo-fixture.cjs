// Exclusivamente local: auth e atualização de foto em memória, sem banco real.
const http=require('node:http');
const uid='99999999-9999-4999-8999-999999999999',shop='11111111-1111-1111-1111-111111111111';
const barbers=[{id:'22222222-2222-2222-2222-222222222221',barbershop_id:shop,name:'Carlos',bio:'Corte e barba',avatar_url:null,is_active:true},{id:'22222222-2222-2222-2222-222222222222',barbershop_id:shop,name:'Jeronimo',bio:'Corte e acabamento',avatar_url:null,is_active:true}];
const user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.test'};
http.createServer(async(req,res)=>{
 res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*');res.setHeader('access-control-allow-methods','GET,POST,PATCH,OPTIONS');res.setHeader('content-type','application/json');
 if(req.method==='OPTIONS'){res.end();return}
 const url=new URL(req.url,'http://localhost'),table=url.pathname.split('/').pop();let data=[];
 if(table==='user')data=user;
 if(table==='shop_members')data={barbershop_id:shop,role:'owner',barbershops:{name:'Auto Stilo'}};
 if(['barbers','public_barbers'].includes(table)){
  let rows=barbers.filter(b=>!url.searchParams.get('id')||url.searchParams.get('id')==='eq.'+b.id);
  if(req.method==='PATCH'){let raw='';for await(const part of req)raw+=part;const patch=JSON.parse(raw);rows.forEach(b=>Object.assign(b,patch))}
  data=rows;
 }
 if(table==='services'||table==='public_services')data=[{id:'33333333-3333-3333-3333-333333333331',name:'Corte clássico',price:60,duration_minutes:40}];
 if(table==='site_settings'||table==='public_site_settings')data={deposit_percentage:50};
 if((req.headers.accept||'').includes('object')&&Array.isArray(data))data=data[0]||null;
 if(table==='shop_members'&&!(req.headers.accept||'').includes('object'))data=[data];
 res.end(JSON.stringify(data));
}).listen(54332,'127.0.0.1',()=>console.log('Local photo fixture:54332'));
