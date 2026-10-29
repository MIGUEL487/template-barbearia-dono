import {createClient} from './supabase';
export const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
export function pushSupport() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {standalone?:boolean}).standalone;
  if (ios && !standalone) return 'No iPhone/iPad, abra no Safari, toque em Compartilhar → Adicionar à Tela de Início e abra o app instalado (iOS/iPadOS 16.4 ou superior).';
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'Este navegador não oferece Web Push. Use um navegador compatível em HTTPS.';
  return '';
}
export function applicationServerKey(value: string) {
  const raw = atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('A chave pública VAPID está inválida. Confira a variável de build.');
  return bytes;
}
export async function deviceSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration ? registration.pushManager.getSubscription() : null;
}
export async function deactivateDevicePush() {
  const subscription = await deviceSubscription();
  if (!subscription) return;
  let problem: unknown;
  try {
    const {error} = await createClient().from('push_subscriptions').delete().eq('endpoint',subscription.endpoint);
    if (error) problem = error;
  } finally {
    const removed = await subscription.unsubscribe();
    if (!removed) throw new Error('O navegador não conseguiu desativar este aparelho. Tente novamente.');
  }
  if (problem) throw problem;
}
