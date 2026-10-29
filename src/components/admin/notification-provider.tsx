'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase';
import {bookingNotification,bookingNotificationBody,notificationEventId,type NotificationBooking} from '@/lib/booking-notification';
import {applicationServerKey,deactivateDevicePush,deviceSubscription,pushSupport,vapidPublicKey} from '@/lib/device-push';
import {Button} from '@/components/ui/button';

type Identity={userId:string;shopId:string};
type Notice={eventId:string;title:string;body:string};
type Context={identity:Identity|null;pushEnabled:boolean;busy:boolean;message:string;support:string;permission:string;connected:boolean;soundEnabled:boolean;soundReady:boolean;enablePush:()=>Promise<void>;disablePush:()=>Promise<void>;toggleSound:()=>Promise<void>};
const Notifications=createContext<Context|null>(null);
export const useNotifications=()=>useContext(Notifications);
const refreshAgenda=()=>window.dispatchEvent(new Event('auto-stilo:bookings-changed'));
const report=(operation:string,error:unknown)=>console.error('[Notificações]',operation,error instanceof Error?error.message:error);

export function NotificationProvider({children}:{children:React.ReactNode}){
 const login=usePathname()==='/login';
 const [identity,setIdentity]=useState<Identity|null>(null),[notice,setNotice]=useState<Notice|null>(null);
 const [pushEnabled,setPushEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[support,setSupport]=useState(''),[permission,setPermission]=useState('default'),[connected,setConnected]=useState(false);
 const [soundEnabled,setSoundEnabled]=useState(false),[soundReady,setSoundReady]=useState(false);
 const sound=useRef<HTMLAudioElement|null>(null),soundPrefs=useRef({enabled:false,ready:false}),seen=useRef(new Set<string>());
 const soundKey=identity?`auto-stilo-sound:${identity.userId}:${identity.shopId}`:'';

 useEffect(()=>{
  if(login){setIdentity(null);return;}
  let cancelled=false,revision=0;
  let db:ReturnType<typeof createClient>;
  try{db=createClient();}catch(error){report('configuração',error);return;}
  const hydrate=async()=>{
   const version=++revision;
   const {data:{user},error}=await db.auth.getUser();
   if(cancelled||version!==revision)return;
   if(error||!user){setIdentity(null);return;}
   const result=await db.from('shop_members').select('barbershop_id').eq('user_id',user.id).maybeSingle();
   if(cancelled||version!==revision)return;
   if(result.error||!result.data){setIdentity(null);if(result.error)report('vínculo da loja',result.error);return;}
   const shopId=result.data.barbershop_id;
   setIdentity(current=>current?.userId===user.id&&current.shopId===shopId?current:{userId:user.id,shopId});
  };
  void hydrate();
  const {data:{subscription}}=db.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_OUT'){++revision;setIdentity(null);void deactivateDevicePush().catch(error=>report('saída',error));}
   else if(event==='SIGNED_IN'||event==='USER_UPDATED')setTimeout(()=>{if(!cancelled)void hydrate();},0);
  });
  return()=>{cancelled=true;subscription.unsubscribe();};
 },[login]);

 useEffect(()=>{
  setNotice(null);setPushEnabled(false);setSoundReady(false);seen.current.clear();
  sound.current?.pause();sound.current=null;soundPrefs.current={enabled:false,ready:false};
  if(!identity){setSoundEnabled(false);return;}
  let enabled=false;try{enabled=localStorage.getItem(soundKey)==='on';}catch{}
  setSoundEnabled(enabled);soundPrefs.current.enabled=enabled;
  setSupport(pushSupport());setPermission('Notification' in window?Notification.permission:'unsupported');
  let cancelled=false;
  const inspect=async()=>{
   const subscription=await deviceSubscription();if(!subscription)return;
   const {data,error}=await createClient().from('push_subscriptions').select('id').eq('endpoint',subscription.endpoint).eq('user_id',identity.userId).eq('barbershop_id',identity.shopId).maybeSingle();
   if(!cancelled){setPushEnabled(!!data&&!error);if(error)report('estado deste aparelho',error);}
  };
  void inspect().catch(error=>report('estado do push',error));
  return()=>{cancelled=true;sound.current?.pause();};
 },[identity,soundKey]);

 const playSound=useCallback(async()=>{
  const audio=sound.current||(sound.current=new Audio('/sounds/prim.mp3'));
  audio.currentTime=0;
  await audio.play();setSoundReady(true);soundPrefs.current.ready=true;
 },[]);
 // Restore the saved preference, but unlock audio only inside a user gesture.
 useEffect(()=>{
  if(!soundEnabled||soundReady)return;
  const unlock=(event:Event)=>{if(event.target instanceof Element&&event.target.closest('[data-sound-toggle]'))return;void playSound().catch(()=>{setSoundReady(false);});};
  window.addEventListener('pointerdown',unlock,{once:true});window.addEventListener('keydown',unlock,{once:true});
  return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);};
 },[soundEnabled,soundReady,playSound]);

 const present=useCallback((event:Notice)=>{
  if(seen.current.has(event.eventId))return;
  seen.current.add(event.eventId);if(seen.current.size>256)seen.current.delete(seen.current.values().next().value!);
  setNotice(event);
  if(document.visibilityState==='visible'&&soundPrefs.current.enabled&&soundPrefs.current.ready)void playSound().catch(error=>{setSoundReady(false);soundPrefs.current.ready=false;report('som bloqueado',error);});
 },[playSound]);

 useEffect(()=>{
  if(!identity)return;
  const db=createClient();let active=true;
  const known=new Map<string,NotificationBooking>();
  const snapshot=async()=>{
   const {data,error}=await db.from('bookings').select('id,barbershop_id,barber_id,status,starts_at,ends_at,hold_expires_at,created_at,updated_at').eq('barbershop_id',identity.shopId).in('status',['hold','confirmed']);
   if(error){report('estado inicial dos avisos',error);return;}
   if(active)for(const row of data||[])if(!known.has(row.id))known.set(row.id,row as NotificationBooking);
  };
  const channel=db.channel(`booking-alerts:${identity.shopId}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'bookings',filter:`barbershop_id=eq.${identity.shopId}`},async payload=>{
    refreshAgenda();
    const row=payload.new as NotificationBooking;
    if(!row||row.barbershop_id!==identity.shopId)return;
    const previous={...known.get(row.id),...payload.old as Partial<NotificationBooking>};
    known.set(row.id,row);if(known.size>1024)known.delete(known.keys().next().value!);
    const event=bookingNotification(payload.eventType,row,previous);
    if(!event)return;
    const eventId=await notificationEventId(event.key);
    const {data,error}=await db.from('bookings').select('id,barbers(name),booking_items(service_name)').eq('id',row.id).eq('barbershop_id',identity.shopId).maybeSingle();
    if(error)report('detalhes do aviso',error);
    if(!active)return;
    const barber=data?.barbers as unknown as {name:string}|null;
    const items=data?.booking_items as {service_name:string}[]|undefined;
    present({eventId,title:event.title,body:bookingNotificationBody(row,barber?.name||'Profissional',items?.map(item=>item.service_name)||[])});
   }).subscribe(status=>{if(active){setConnected(status==='SUBSCRIBED');if(status==='SUBSCRIBED')void snapshot();if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')report('Realtime',status);}});
  const fromWorker=(event:MessageEvent)=>{
   if(!active||event.data?.type!=='BOOKING_PUSH'||!/^[a-f0-9]{64}$/.test(event.data.eventId||''))return;
   // Only accept this app's worker, not an arbitrary window message.
   if(!(event.source instanceof ServiceWorker)||new URL(event.source.scriptURL).pathname!=='/booking-push-sw.js')return;
   refreshAgenda();present(event.data);
  };
  navigator.serviceWorker?.addEventListener('message',fromWorker);
  return()=>{active=false;setConnected(false);void db.removeChannel(channel);navigator.serviceWorker?.removeEventListener('message',fromWorker);};
 },[identity,present]);

 const enablePush=async()=>{
  if(!identity||busy)return;setBusy(true);setMessage('');let created:PushSubscription|null=null;
  try{
   const reason=pushSupport();if(reason)throw new Error(reason);
   const key=applicationServerKey(vapidPublicKey);
   // Permission is requested immediately from this explicit button click.
   const allowed=await Notification.requestPermission();setPermission(allowed);
   if(allowed!=='granted')throw new Error(allowed==='denied'?'Notificações bloqueadas. Libere este site nas permissões do navegador ou do app instalado.':'Permissão não concedida. Você pode tentar novamente.');
   await navigator.serviceWorker.register('/booking-push-sw.js',{scope:'/',updateViaCache:'none'});
   const registration=await new Promise<ServiceWorkerRegistration>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('O serviço de notificações não iniciou. Reabra o painel e tente novamente.')),15000);
    void navigator.serviceWorker.ready.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
   });
   let subscription=await registration.pushManager.getSubscription();
   if(subscription){
    const {data,error}=await createClient().from('push_subscriptions').select('id').eq('endpoint',subscription.endpoint).eq('user_id',identity.userId).eq('barbershop_id',identity.shopId).maybeSingle();
    if(error)throw error;
    const existingKey=subscription.options.applicationServerKey;
    const matches=existingKey&&new Uint8Array(existingKey).every((byte,index)=>key[index]===byte)&&existingKey.byteLength===key.length;
    if(data&&matches){setPushEnabled(true);setMessage('Este aparelho está ativado.');return;}
    await deactivateDevicePush();subscription=null;
   }
   subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});created=subscription;
   const json=subscription.toJSON();if(!json.keys?.p256dh||!json.keys.auth)throw new Error('O navegador não forneceu as chaves da inscrição.');
   const {error}=await createClient().from('push_subscriptions').insert({barbershop_id:identity.shopId,user_id:identity.userId,endpoint:subscription.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth,user_agent:navigator.userAgent.slice(0,512)});
   if(error)throw error;
   setPushEnabled(true);setMessage('Notificações ativadas neste aparelho.');
  }catch(error){if(created)await created.unsubscribe().catch(()=>{});report('ativar push',error);setMessage(error instanceof Error?error.message:'Não foi possível salvar a inscrição. Confira a instalação do SQL e tente novamente.');}
  finally{setBusy(false);}
 };
 const disablePush=async()=>{
  setBusy(true);setMessage('');try{await deactivateDevicePush();setPushEnabled(false);setMessage('Notificações desativadas neste aparelho.');}
  catch(error){setPushEnabled(false);report('desativar push',error);setMessage('Não foi possível concluir a remoção da inscrição. Tente novamente.');}finally{setBusy(false);}
 };
 const toggleSound=async()=>{
  if(soundEnabled&&soundReady){setSoundEnabled(false);setSoundReady(false);soundPrefs.current={enabled:false,ready:false};sound.current?.pause();try{localStorage.setItem(soundKey,'off');}catch{};return;}
  try{await playSound();setSoundEnabled(true);soundPrefs.current.enabled=true;try{localStorage.setItem(soundKey,'on');}catch{};setMessage('Som ativado enquanto este painel estiver visível.');}
  catch(error){report('ativar som',error);setMessage('O navegador bloqueou o áudio. Toque em Ativar som novamente.');}
 };
 return <Notifications.Provider value={{identity,pushEnabled,busy,message,support,permission,connected,soundEnabled,soundReady,enablePush,disablePush,toggleSound}}>{children}
  {identity&&notice&&<aside aria-label="Aviso de reserva" role="status" className="fixed top-6 right-4 left-4 md:left-auto md:w-96 z-50 bg-surface text-text rounded-[28px] p-6 shadow-soft space-y-4">
   <h2 className="font-serif text-xl">{notice.title}</h2><p className="text-sm text-text-muted">{notice.body}</p>
   <div className="flex items-center gap-4"><Link href="/agenda" className="text-sm text-accent">Abrir agenda</Link><Button type="button" variant="ghost" size="sm" onClick={()=>setNotice(null)}>Fechar aviso</Button></div>
  </aside>}
 </Notifications.Provider>;
}
