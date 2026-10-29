/** Pure shared event logic, deployable with Supabase and imported by the panel. */
export type NotificationBooking = {
  id: string; barbershop_id: string; barber_id: string; status: string;
  starts_at: string; ends_at: string; hold_expires_at?: string | null;
  updated_at?: string; created_at?: string;
};
export function bookingNotification(type: string, row: NotificationBooking, old: Partial<NotificationBooking> = {}, now = Date.now()) {
  const instant=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
  if (!row.id || !row.barbershop_id || !instant(row.starts_at) || !instant(row.ends_at)) return null;
  if (row.status === 'hold' && (!row.hold_expires_at || !(Date.parse(row.hold_expires_at) > now))) return null;
  let title: string | null = null;
  if (type === 'INSERT') title = row.status === 'hold' ? 'Nova pré-reserva' : row.status === 'confirmed' ? 'Reserva confirmada' : null;
  if (type === 'UPDATE') {
    // Realtime with RLS can provide only the old primary key. Its caller must
    // supply a previous snapshot; do not invent a confirmation from missing data.
    if (!old.status) return null;
    if (row.status === 'confirmed' && old.status !== 'confirmed') title = 'Reserva confirmada';
    else if (row.status === 'cancelled' && ['hold', 'confirmed'].includes(old.status || '')) title = 'Reserva cancelada';
    else if (['hold', 'confirmed'].includes(row.status) && (instant(row.starts_at) !== instant(old.starts_at) || instant(row.ends_at) !== instant(old.ends_at) || row.barber_id !== old.barber_id)) title = 'Reserva alterada';
  }
  if (!title) return null;
  // Webhook, PostgREST and Realtime can format the SAME timestamp differently.
  const key = JSON.stringify([row.id, row.status, instant(row.starts_at), instant(row.ends_at), row.barber_id, instant(row.updated_at || row.created_at)]);
  return { title, key };
}
export async function notificationEventId(key: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function bookingNotificationBody(row: NotificationBooking, barber: string, services: string[]) {
  const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120);
  const when = new Date(row.starts_at).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  return `${clean(barber || 'Profissional')} · ${services.slice(0, 3).map(clean).join(', ') || 'Serviço'} · ${when} (Brasília)`;
}
