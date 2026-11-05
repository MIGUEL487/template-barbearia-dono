-- Somente leitura. Não altera permissões, políticas, funções nem contadores.
SELECT n.nspname AS schema_name,p.proname,p.proargnames,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_result(p.oid) AS result_type,p.prosecdef AS security_definer,
       p.proconfig,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('consume_raiox_ai_quota','saas_can_manage')
ORDER BY p.proname,identity_arguments;

SELECT n.nspname,c.relname,c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_direct_insert,
       has_table_privilege('anon',c.oid,'INSERT') AS anon_direct_insert
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='ai_daily_usage';
-- Esperado: RPC(uuid) -> boolean; nome do parâmetro p_barbershop_id;
-- SECURITY DEFINER com search_path fixo; authenticated EXECUTE=true, anon=false.
-- ai_daily_usage com RLS; sem INSERT direto ao cliente. Ausência de policy pública é intencional.
-- Não use o SQL Editor como prova da sessão do painel: auth.uid() ali não é o usuário do navegador.
