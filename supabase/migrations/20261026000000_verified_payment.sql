-- PROPOSTA: NÃO APLICADA. Requer autorização e validação em banco demo dedicado.
-- Executada apenas pelo webhook server-side após conferir assinatura e API oficial.
CREATE OR REPLACE FUNCTION public.process_verified_payment(p_payment_id text,p_booking_id uuid,p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b public.bookings%ROWTYPE; p public.payments%ROWTYPE;
BEGIN
 IF p_payment_id !~ '^[0-9]+$' OR p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Pagamento inválido'; END IF;
 -- Serializa também eventos concorrentes que apontam para a mesma reserva.
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva inexistente'; END IF;
 -- Cada lançamento do checkout deve ter um payment explícito. Não inventar amount.
 SELECT * INTO p FROM public.payments WHERE booking_id=b.id AND barbershop_id=b.barbershop_id ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR p.amount <> p_amount THEN RAISE EXCEPTION 'Valor divergente'; END IF;
 IF p.status='approved' THEN
  IF p.external_payment_id=p_payment_id THEN RETURN jsonb_build_object('duplicate',true); END IF;
  RAISE EXCEPTION 'Reserva já liquidada por outro pagamento';
 END IF;
 IF b.status NOT IN ('hold','confirmed') THEN RAISE EXCEPTION 'Reserva não pode ser confirmada'; END IF;
 IF b.status='hold' AND b.hold_expires_at IS NOT NULL AND b.hold_expires_at<=now() THEN RAISE EXCEPTION 'Hold expirado: requer conciliação manual'; END IF;
 INSERT INTO public.payment_events(event_key,event_type,payload) VALUES('mp_approved_'||p_payment_id,'payment.approved',jsonb_build_object('booking_id',b.id,'processed_at',now()));
 UPDATE public.bookings SET status='confirmed',updated_at=now() WHERE id=b.id;
 UPDATE public.payments SET status='approved',external_payment_id=p_payment_id,updated_at=now() WHERE id=p.id;
 INSERT INTO public.financial_transactions(barbershop_id,booking_id,payment_id,type,amount,description) VALUES(b.barbershop_id,b.id,p.id,'income',p_amount,'Mercado Pago verificado');
 RETURN jsonb_build_object('processed',true);
END $$;
REVOKE ALL ON FUNCTION public.process_verified_payment(text,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_payment(text,uuid,numeric) TO service_role;
