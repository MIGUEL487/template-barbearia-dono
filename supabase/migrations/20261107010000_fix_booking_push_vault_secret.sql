-- Correção definitiva do disparo automático de notificações via pg_net e Supabase Vault
-- 1. Garante que o segredo no Vault não possua caracteres de quebra de linha residuais (\r, \n, espaços).
-- 2. Atualiza public.notify_booking_push() para sanitizar (trim) o segredo defensivamente e tratar exceções.

BEGIN;

-- Sanitiza o segredo no Supabase Vault caso contenha \r, \n ou espaços
DO $$
DECLARE
  v_id uuid;
  v_trimmed text;
BEGIN
  SELECT id, trim(both E'\r\n ' from decrypted_secret)
    INTO v_id, v_trimmed
  FROM vault.decrypted_secrets
  WHERE name = 'booking_webhook_secret'
  LIMIT 1;

  IF v_id IS NOT NULL AND v_trimmed IS NOT NULL AND length(v_trimmed) >= 32 THEN
    PERFORM vault.update_secret(
      secret_id := v_id,
      new_secret := v_trimmed
    );
  END IF;
END $$;

-- Atualiza a função do trigger para garantir integridade dos headers HTTP e resiliência
CREATE OR REPLACE FUNCTION public.notify_booking_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'net'
AS $function$
declare
  v_secret text;
begin
  select trim(both E'\r\n ' from decrypted_secret)
    into v_secret
  from vault.decrypted_secrets
  where name = 'booking_webhook_secret'
  limit 1;

  if v_secret is null or length(v_secret) < 32 then
    raise warning '[notify_booking_push] segredo do Vault ausente ou inválido';
    return new;
  end if;

  perform net.http_post(
    url := 'https://jrzabortkpouqkwndpcq.supabase.co/functions/v1/send-booking-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'record', to_jsonb(new),
      'old_record', case
        when tg_op = 'UPDATE' then to_jsonb(old)
        else null
      end,
      'type', tg_op,
      'table', 'bookings',
      'schema', 'public'
    )
  );

  return new;
exception
  when others then
    raise warning '[notify_booking_push] erro ao disparar webhook de push: %', sqlerrm;
    return new;
end;
$function$;

COMMIT;
