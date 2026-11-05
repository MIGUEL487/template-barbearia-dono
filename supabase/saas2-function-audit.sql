-- READ ONLY: schema/defaults/grants/dependencies. No customer data or migration execution.
-- Run before/after the installer; keep the result with the installation record.
SELECT p.oid::regprocedure AS identity,
       pg_get_function_arguments(p.oid) AS arguments_with_defaults,
       pg_get_function_result(p.oid) AS result,
       p.pronargs - p.pronargdefaults AS required_arguments,
       p.prosecdef AS security_definer, p.proconfig AS function_settings,
       p.proacl AS grants
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'get_group_availability','create_group_booking_hold','get_availability','create_booking_hold',
 'saas_can_manage','consume_raiox_ai_quota','join_waitlist','offer_waitlist','cancel_waitlist')
ORDER BY p.proname,p.oid;

-- Catalog-tracked dependencies: views, parsed SQL functions, etc.
-- PL/pgSQL/dynamic SQL references may not be recorded in pg_depend.
SELECT pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent_object,
       d.deptype AS dependency_type,
       pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) AS referenced_object
FROM pg_depend d
WHERE d.refclassid='pg_proc'::regclass
  AND d.refobjid=to_regprocedure('public.create_booking_hold(uuid,uuid,timestamptz,uuid[],text,text,text,boolean)')
ORDER BY 1;

-- All overloads with these names are shown by the first query. This query flags
-- pairs whose optional positional arguments have a common exact typed prefix.
-- Also review parameter names/types for PostgREST; do not remove any overload automatically.
WITH candidates AS (
 SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
 'get_group_availability','create_group_booking_hold','get_availability','create_booking_hold',
 'saas_can_manage','consume_raiox_ai_quota','join_waitlist','offer_waitlist','cancel_waitlist')
), pairs AS (
 SELECT a.oid AS left_oid,b.oid AS right_oid,a.proargtypes AS left_types,b.proargtypes AS right_types,
        greatest(a.pronargs-a.pronargdefaults,b.pronargs-b.pronargdefaults) AS min_arguments,
        least(a.pronargs,b.pronargs) AS max_arguments
 FROM candidates a JOIN candidates b ON a.proname=b.proname AND a.oid<b.oid
)
SELECT left_oid::regprocedure AS left_function,right_oid::regprocedure AS right_function,
       min_arguments AS first_potentially_ambiguous_arity,max_arguments
FROM pairs WHERE min_arguments<=max_arguments AND NOT EXISTS(
 SELECT 1 FROM generate_series(0,min_arguments-1) position
 WHERE left_types[position]<>right_types[position])
ORDER BY 1,2;
