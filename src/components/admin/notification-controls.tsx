'use client';
import {useNotifications} from './notification-provider';
import {vapidPublicKey} from '@/lib/device-push';
import {Card,CardTitle,CardDescription} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
export function NotificationControls({compact=false}:{compact?:boolean}){
 const state=useNotifications();if(!state?.identity)return null;
 return <Card className="space-y-4" aria-label="Notificações deste aparelho">
  {!compact&&<CardTitle>Notificações</CardTitle>}
  <CardDescription>{compact?'Avisos e som neste aparelho':state.pushEnabled?'Este aparelho está ativado para receber novas pré-reservas e alterações.':'Receba novas pré-reservas mesmo com o painel fechado.'}</CardDescription>
  <div className="flex flex-wrap gap-4">
   <Button type="button" size="sm" variant={state.pushEnabled?'secondary':'primary'} isLoading={state.busy} disabled={!state.pushEnabled&&(!vapidPublicKey||!!state.support||state.permission==='denied')} onClick={()=>void(state.pushEnabled?state.disablePush():state.enablePush())}>{state.pushEnabled?'Desativar neste aparelho':'Ativar notificações'}</Button>
   <Button type="button" size="sm" variant="secondary" data-sound-toggle aria-pressed={state.soundEnabled&&state.soundReady} onClick={()=>void state.toggleSound()}>{state.soundEnabled&&state.soundReady?'Silenciar':state.soundEnabled?'Reativar som neste acesso':'Ativar som'}</Button>
  </div>
  {state.support&&<p className="text-sm text-text-muted">{state.support}</p>}
  {!vapidPublicKey&&<p className="text-sm text-text-muted">O push ainda precisa ser configurado pelo administrador. O aviso e o som no painel funcionam separadamente.</p>}
  {state.permission==='denied'&&<p className="text-sm text-text-muted">Permissão bloqueada. Nas configurações do navegador ou do app instalado, permita notificações para este site e reabra o painel.</p>}
  <p className="text-xs text-text-muted">{state.connected?'Agenda conectada em tempo real.':'Conectando avisos em tempo real. Se persistir, confira sua conexão e a configuração do Realtime.'} {state.soundEnabled&&!state.soundReady?'Sua preferência de som foi salva; um toque neste acesso libera o áudio.':''}</p>
  {state.message&&<p role="status" className="text-sm text-text-muted">{state.message}</p>}
 </Card>;
}
