-- Private queue. Public access is insert-only through validated RPC; no outgoing messages.
BEGIN;
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),barbershop_id uuid NOT NULL REFERENCES public.barbershops(id),barber_id uuid REFERENCES public.barbers(id),service_ids uuid[] NOT NULL CHECK(cardinality(service_ids) BETWEEN 1 AND 100),date date NOT NULL,window_start time NOT NULL,window_end time NOT NULL CHECK(window_end>window_start),customer_name text NOT NULL,phone text NOT NULL,email text,contact_channel text NOT NULL CHECK(contact_channel IN ('phone','email')),contact_consent boolean NOT NULL CHECK(contact_consent),status text NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','offered','cancelled')),offered_booking_id uuid REFERENCES public.bookings(id),offer_expires_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS waitlist_shop_day_order ON public.waitlist_entries(barbershop_id,date,created_at,id);
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_entries FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.waitlist_entries TO authenticated;
DROP POLICY IF EXISTS waitlist_manage ON public.waitlist_entries;
CREATE POLICY waitlist_manage ON public.waitlist_entries FOR SELECT TO authenticated USING(public.saas_can_manage(barbershop_id));
-- Mutation only through RPC: direct updates could reorder the queue or bypass capacity checks.
REVOKE UPDATE ON public.waitlist_entries FROM authenticated;
CREATE OR REPLACE FUNCTION public.join_waitlist(p_barbershop_id uuid,p_barber_id uuid,p_service_ids uuid[],p_date date,p_window_start time,p_window_end time,p_customer_name text,p_phone text,p_email text,p_contact_channel text,p_consent boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions,pg_temp AS $$
DECLARE v_id uuid;v_phone text:=regexp_replace(p_phone,'[^0-9]','','g');
BEGIN
 IF p_consent IS DISTINCT FROM true OR p_customer_name IS NULL OR length(trim(p_customer_name)) NOT BETWEEN 2 AND 120 OR v_phone IS NULL OR length(v_phone) NOT BETWEEN 8 AND 15 OR length(COALESCE(p_email,''))>254 OR p_contact_channel IS NULL OR p_contact_channel NOT IN ('phone','email') OR (p_contact_channel='email' AND COALESCE(p_email,'')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Confira o contato e autorize o contato manual.'; END IF;
 IF p_date IS NULL OR p_date<(now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_date>(now() AT TIME ZONE 'America/Sao_Paulo')::date+90 OR p_window_start IS NULL OR p_window_end IS NULL OR p_window_start>=p_window_end THEN RAISE EXCEPTION 'Data ou janela de horário inválida.'; END IF;
 IF p_service_ids IS NULL OR cardinality(p_service_ids) NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM unnest(p_service_ids) i GROUP BY i HAVING count(*)>6) OR (SELECT count(*) FROM public.services s JOIN unnest(p_service_ids) r(id) ON r.id=s.id WHERE s.barbershop_id=p_barbershop_id AND s.is_active)<>cardinality(p_service_ids) OR (p_barber_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.barbers WHERE id=p_barber_id AND barbershop_id=p_barbershop_id AND is_active)) THEN RAISE EXCEPTION 'Serviço ou profissional inválido.'; END IF;
 IF EXISTS(SELECT 1 FROM public.closed_days WHERE barbershop_id=p_barbershop_id AND date=p_date) OR NOT EXISTS(SELECT 1 FROM public.barbers b JOIN public.working_hours wh ON wh.barber_id=b.id WHERE b.barbershop_id=p_barbershop_id AND b.is_active AND (p_barber_id IS NULL OR b.id=p_barber_id) AND wh.day_of_week=extract(dow from p_date) AND NOT wh.is_off AND wh.start_time<p_window_end AND wh.end_time>p_window_start) THEN RAISE EXCEPTION 'Não há expediente compatível nesta data e janela.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text||p_date::text,0));
 IF (SELECT count(*) FROM public.waitlist_entries WHERE barbershop_id=p_barbershop_id AND date=p_date AND status IN ('waiting','offered'))>=500 THEN RAISE EXCEPTION 'Lista desta data atingiu o limite. Fale com a barbearia.'; END IF;
 SELECT id INTO v_id FROM public.waitlist_entries WHERE barbershop_id=p_barbershop_id AND date=p_date AND phone=v_phone AND status IN ('waiting','offered') AND barber_id IS NOT DISTINCT FROM p_barber_id AND service_ids=p_service_ids AND window_start=p_window_start AND window_end=p_window_end ORDER BY created_at,id LIMIT 1;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 IF (SELECT count(*) FROM public.waitlist_entries WHERE barbershop_id=p_barbershop_id AND date=p_date AND phone=v_phone AND status IN ('waiting','offered'))>=3 THEN RAISE EXCEPTION 'Você já tem solicitações para esta data.'; END IF;
 INSERT INTO public.waitlist_entries(barbershop_id,barber_id,service_ids,date,window_start,window_end,customer_name,phone,email,contact_channel,contact_consent) VALUES(p_barbershop_id,p_barber_id,p_service_ids,p_date,p_window_start,p_window_end,trim(p_customer_name),v_phone,nullif(trim(p_email),''),p_contact_channel,true) RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
CREATE OR REPLACE FUNCTION public.offer_waitlist(p_barbershop_id uuid,p_entry_id uuid,p_barber_id uuid,p_starts_at timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions,pg_temp AS $$
DECLARE e public.waitlist_entries;prior public.waitlist_entries;result jsonb;slot_local timestamp;
BEGIN
 IF NOT public.saas_can_manage(p_barbershop_id) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.waitlist_entries WHERE id=p_entry_id AND barbershop_id=p_barbershop_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text||e.date::text,0));
 SELECT * INTO e FROM public.waitlist_entries WHERE id=p_entry_id AND barbershop_id=p_barbershop_id FOR UPDATE;
 IF e.status='offered' AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=e.offered_booking_id AND (b.status IN ('confirmed','completed') OR (b.status='hold' AND b.hold_expires_at>now()))) THEN RETURN jsonb_build_object('booking_id',e.offered_booking_id,'already_offered',true,'hold_expires_at',e.offer_expires_at); END IF;
 IF e.status='cancelled' THEN RAISE EXCEPTION 'Solicitação cancelada'; END IF;
 slot_local:=p_starts_at AT TIME ZONE 'America/Sao_Paulo';
 IF p_starts_at IS NULL OR slot_local::date<>e.date OR slot_local::time<e.window_start OR slot_local::time>=e.window_end OR p_barber_id IS NULL OR (e.barber_id IS NOT NULL AND e.barber_id<>p_barber_id) THEN RAISE EXCEPTION 'Horário fora da preferência'; END IF;
 -- FIFO among requests that can actually use this start/barber, even when their service differs.
 FOR prior IN SELECT * FROM public.waitlist_entries w WHERE w.barbershop_id=p_barbershop_id AND w.date=e.date AND (w.created_at,w.id)<(e.created_at,e.id) AND (w.barber_id IS NULL OR w.barber_id=p_barber_id) AND w.window_start<=slot_local::time AND w.window_end>slot_local::time AND (w.status='waiting' OR (w.status='offered' AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=w.offered_booking_id AND (b.status IN ('confirmed','completed') OR (b.status='hold' AND b.hold_expires_at>now()))))) ORDER BY w.created_at,w.id LOOP
  IF EXISTS(SELECT 1 FROM public.get_group_availability(p_barbershop_id,p_barber_id,e.date,prior.service_ids) a WHERE a.start_time=p_starts_at) THEN RAISE EXCEPTION 'Há uma solicitação anterior elegível para esta vaga. Atenda a ordem da fila.'; END IF;
 END LOOP;
 result:=public.create_group_booking_hold(p_barbershop_id,p_barber_id,p_starts_at,e.service_ids,e.customer_name,e.phone,e.email,false);
 UPDATE public.waitlist_entries SET status='offered',offered_booking_id=(result->>'booking_id')::uuid,offer_expires_at=(result->>'hold_expires_at')::timestamptz,updated_at=now() WHERE id=e.id;
 RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION public.cancel_waitlist(p_barbershop_id uuid,p_entry_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN IF NOT public.saas_can_manage(p_barbershop_id) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF; UPDATE public.waitlist_entries SET status='cancelled',updated_at=now() WHERE id=p_entry_id AND barbershop_id=p_barbershop_id AND (status='waiting' OR (status='offered' AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=waitlist_entries.offered_booking_id AND (b.status IN ('confirmed','completed') OR (b.status='hold' AND b.hold_expires_at>now()))))); IF NOT FOUND THEN RAISE EXCEPTION 'Só é possível retirar uma solicitação aguardando ou uma oferta encerrada. Reservas ativas são gerenciadas na agenda.'; END IF; END; $$;
REVOKE ALL ON FUNCTION public.join_waitlist(uuid,uuid,uuid[],date,time,time,text,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_waitlist(uuid,uuid,uuid[],date,time,time,text,text,text,text,boolean) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.offer_waitlist(uuid,uuid,uuid,timestamptz),public.cancel_waitlist(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_waitlist(uuid,uuid,uuid,timestamptz),public.cancel_waitlist(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
