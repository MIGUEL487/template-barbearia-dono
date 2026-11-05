-- Manual installation only. Additive schema; no automatic jobs or customer seed.
BEGIN;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS entry_status text NOT NULL DEFAULT 'settled' CHECK(entry_status IN ('settled','pending','void'));
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS entry_origin text NOT NULL DEFAULT 'automatic' CHECK(entry_origin IN ('automatic','manual'));
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Outros';
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS payment_label text;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS financial_manual_request ON public.financial_transactions(barbershop_id,request_id) WHERE request_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.financial_entry_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),barbershop_id uuid NOT NULL REFERENCES public.barbershops(id),entry_id uuid NOT NULL REFERENCES public.financial_transactions(id),user_id uuid NOT NULL REFERENCES auth.users(id),operation text NOT NULL,before_value jsonb,after_value jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.financial_categories(barbershop_id uuid NOT NULL REFERENCES public.barbershops(id),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 60),type text NOT NULL CHECK(type IN ('income','expense')),PRIMARY KEY(barbershop_id,name,type));
ALTER TABLE public.financial_entry_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_entry_audit,public.financial_categories FROM anon,authenticated;
GRANT SELECT ON public.financial_entry_audit,public.financial_categories TO authenticated;
DROP POLICY IF EXISTS financial_audit_manager ON public.financial_entry_audit;
CREATE POLICY financial_audit_manager ON public.financial_entry_audit FOR SELECT TO authenticated USING(public.saas_can_manage(barbershop_id));
DROP POLICY IF EXISTS financial_categories_manager ON public.financial_categories;
CREATE POLICY financial_categories_manager ON public.financial_categories FOR SELECT TO authenticated USING(public.saas_can_manage(barbershop_id));
DROP POLICY IF EXISTS financial_manager_read ON public.financial_transactions;
CREATE POLICY financial_manager_read ON public.financial_transactions AS RESTRICTIVE FOR SELECT TO authenticated USING(public.saas_can_manage(barbershop_id));
-- Protect manual/conciliated entries even when older permissive table policies exist.
CREATE OR REPLACE FUNCTION public.guard_financial_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'Use o fluxo financeiro autorizado.' USING ERRCODE='42501'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
DROP TRIGGER IF EXISTS guard_financial_entry ON public.financial_transactions;
CREATE TRIGGER guard_financial_entry BEFORE INSERT OR UPDATE OR DELETE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_financial_entry();
CREATE OR REPLACE FUNCTION public.save_manual_financial_entry(p_shop uuid,p_request uuid,p_entry uuid,p_type text,p_description text,p_category text,p_amount numeric,p_date date,p_method text,p_status text,p_metadata jsonb,p_booking uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old_entry public.financial_transactions;v_id uuid;new_entry public.financial_transactions;
BEGIN
 IF NOT public.saas_can_manage(p_shop) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501';END IF;
 IF p_booking IS NOT NULL THEN
  IF p_entry IS NOT NULL OR p_type IS DISTINCT FROM 'income' THEN RAISE EXCEPTION 'Vínculo de agendamento permitido apenas ao reutilizar uma receita.';END IF;
  SELECT t.id INTO v_id FROM public.financial_transactions t JOIN public.bookings b ON b.id=t.booking_id WHERE t.barbershop_id=p_shop AND b.barbershop_id=p_shop AND b.id=p_booking AND t.type='income' AND t.entry_status='settled' ORDER BY t.created_at,t.id LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Sem recebimento conciliado. Use o fluxo de pagamento do agendamento.';END IF;
  RETURN jsonb_build_object('id',v_id,'reused',true);
 END IF;
 IF p_request IS NULL OR p_type IS NULL OR p_type NOT IN ('income','expense') OR p_status IS NULL OR p_status NOT IN ('settled','pending') OR p_description IS NULL OR length(trim(p_description)) NOT BETWEEN 2 AND 200 OR p_category IS NULL OR length(trim(p_category)) NOT BETWEEN 2 AND 60 OR p_amount IS NULL OR p_amount<=0 OR p_amount>=100000000 OR round(p_amount,2)<>p_amount OR p_date IS NULL OR p_date<date '2020-01-01' OR p_date>current_date+366 OR length(coalesce(p_method,''))>40 OR p_metadata IS NULL OR jsonb_typeof(p_metadata)<>'object' OR length(p_metadata::text)>2000 THEN RAISE EXCEPTION 'Dados financeiros inválidos.';END IF;
 IF p_metadata?'quantity' OR p_metadata?'unit_price' THEN
  IF coalesce((p_metadata->>'quantity')::numeric,0)<=0 OR coalesce((p_metadata->>'quantity')::numeric,0)>9999 OR coalesce((p_metadata->>'unit_price')::numeric,0)<=0 OR round((p_metadata->>'quantity')::numeric*(p_metadata->>'unit_price')::numeric,2)<>p_amount THEN RAISE EXCEPTION 'Quantidade, preço unitário e total divergentes.';END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_shop::text||p_request::text,0));
 IF p_entry IS NULL THEN
  SELECT id INTO v_id FROM public.financial_transactions WHERE barbershop_id=p_shop AND request_id=p_request;
  IF FOUND THEN RETURN jsonb_build_object('id',v_id,'duplicate',true);END IF;
  INSERT INTO public.financial_transactions(barbershop_id,type,amount,description,created_at,entry_origin,entry_status,category,payment_label,metadata,request_id) VALUES(p_shop,p_type,p_amount,trim(p_description),(p_date+time '12:00') AT TIME ZONE 'America/Sao_Paulo','manual',p_status,trim(p_category),p_method,p_metadata,p_request) RETURNING * INTO new_entry;
 ELSE
  SELECT * INTO old_entry FROM public.financial_transactions WHERE id=p_entry AND barbershop_id=p_shop FOR UPDATE;
  IF NOT FOUND OR old_entry.entry_origin<>'manual' OR old_entry.booking_id IS NOT NULL OR old_entry.payment_id IS NOT NULL OR old_entry.entry_status='void' THEN RAISE EXCEPTION 'Lançamento conciliado/automático não pode ser editado.';END IF;
  IF old_entry.type=p_type AND old_entry.amount=p_amount AND old_entry.description=trim(p_description) AND old_entry.category=trim(p_category) AND old_entry.payment_label IS NOT DISTINCT FROM p_method AND old_entry.entry_status=p_status AND old_entry.metadata=p_metadata AND (old_entry.created_at AT TIME ZONE 'America/Sao_Paulo')::date=p_date THEN RETURN jsonb_build_object('id',old_entry.id,'duplicate',true);END IF;
  UPDATE public.financial_transactions SET type=p_type,amount=p_amount,description=trim(p_description),created_at=(p_date+time '12:00') AT TIME ZONE 'America/Sao_Paulo',entry_status=p_status,category=trim(p_category),payment_label=p_method,metadata=p_metadata WHERE id=p_entry RETURNING * INTO new_entry;
 END IF;
 INSERT INTO public.financial_categories VALUES(p_shop,trim(p_category),p_type) ON CONFLICT DO NOTHING;
 INSERT INTO public.financial_entry_audit(barbershop_id,entry_id,user_id,operation,before_value,after_value) VALUES(p_shop,new_entry.id,auth.uid(),CASE WHEN p_entry IS NULL THEN 'create' ELSE 'edit' END,to_jsonb(old_entry),to_jsonb(new_entry));
 RETURN jsonb_build_object('id',new_entry.id,'reused',false);
END; $$;
CREATE OR REPLACE FUNCTION public.void_manual_financial_entry(p_shop uuid,p_entry uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE e public.financial_transactions;BEGIN
 IF NOT public.saas_can_manage(p_shop) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.financial_transactions WHERE id=p_entry AND barbershop_id=p_shop FOR UPDATE;
 IF NOT FOUND OR e.entry_origin<>'manual' OR e.booking_id IS NOT NULL OR e.payment_id IS NOT NULL THEN RAISE EXCEPTION 'Recebimento automático/conciliado deve ser tratado pelo fluxo original.';END IF;
 IF e.entry_status='void' THEN RETURN;END IF;
 UPDATE public.financial_transactions SET entry_status='void' WHERE id=e.id;
 INSERT INTO public.financial_entry_audit(barbershop_id,entry_id,user_id,operation,before_value,after_value) VALUES(p_shop,e.id,auth.uid(),'void',to_jsonb(e),jsonb_build_object('entry_status','void'));
END; $$;
CREATE TABLE IF NOT EXISTS public.raiox_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),barbershop_id uuid NOT NULL REFERENCES public.barbershops(id),user_id uuid NOT NULL REFERENCES auth.users(id),title text NOT NULL CHECK(length(title) BETWEEN 1 AND 80),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.raiox_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES public.raiox_conversations(id),request_id uuid NOT NULL,role text NOT NULL CHECK(role IN ('user','assistant')),content text NOT NULL CHECK(length(content)<=12000),payload jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(conversation_id,request_id,role));
CREATE TABLE IF NOT EXISTS public.raiox_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),barbershop_id uuid NOT NULL REFERENCES public.barbershops(id),date date NOT NULL,kind text NOT NULL CHECK(kind IN ('briefing','closing')),payload jsonb NOT NULL,generated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(barbershop_id,date,kind));
ALTER TABLE public.raiox_conversations ENABLE ROW LEVEL SECURITY;ALTER TABLE public.raiox_messages ENABLE ROW LEVEL SECURITY;ALTER TABLE public.raiox_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.raiox_conversations,public.raiox_messages,public.raiox_reports FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.raiox_conversations TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.raiox_messages TO authenticated;
GRANT SELECT,INSERT ON public.raiox_reports TO authenticated;
DROP POLICY IF EXISTS raiox_conversation_owner ON public.raiox_conversations;
CREATE POLICY raiox_conversation_owner ON public.raiox_conversations TO authenticated USING(user_id=auth.uid() AND public.saas_can_manage(barbershop_id)) WITH CHECK(user_id=auth.uid() AND public.saas_can_manage(barbershop_id));
DROP POLICY IF EXISTS raiox_message_owner ON public.raiox_messages;
CREATE POLICY raiox_message_owner ON public.raiox_messages TO authenticated USING(EXISTS(SELECT 1 FROM public.raiox_conversations c WHERE c.id=conversation_id AND c.user_id=auth.uid() AND public.saas_can_manage(c.barbershop_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.raiox_conversations c WHERE c.id=conversation_id AND c.user_id=auth.uid() AND public.saas_can_manage(c.barbershop_id)));
DROP POLICY IF EXISTS raiox_report_shop ON public.raiox_reports;
CREATE POLICY raiox_report_shop ON public.raiox_reports TO authenticated USING(public.saas_can_manage(barbershop_id)) WITH CHECK(public.saas_can_manage(barbershop_id));
REVOKE ALL ON FUNCTION public.save_manual_financial_entry(uuid,uuid,uuid,text,text,text,numeric,date,text,text,jsonb,uuid),public.void_manual_financial_entry(uuid,uuid),public.guard_financial_entry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_manual_financial_entry(uuid,uuid,uuid,text,text,text,numeric,date,text,text,jsonb,uuid),public.void_manual_financial_entry(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.delete_raiox_conversation(p_shop uuid,p_conversation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT public.saas_can_manage(p_shop) OR NOT EXISTS(SELECT 1 FROM public.raiox_conversations WHERE id=p_conversation AND barbershop_id=p_shop AND user_id=auth.uid() FOR UPDATE) THEN RAISE EXCEPTION 'Conversa não autorizada.' USING ERRCODE='42501';END IF;
 DELETE FROM public.raiox_messages WHERE conversation_id=p_conversation;
 DELETE FROM public.raiox_conversations WHERE id=p_conversation;
END; $$;
REVOKE ALL ON FUNCTION public.delete_raiox_conversation(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_raiox_conversation(uuid,uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
