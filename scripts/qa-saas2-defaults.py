"""Regression for 42P13. Fixed local Docker target, schema-only clone, synthetic seed only.
Never connects to a Supabase URL. Does not execute the installer in production.
"""
import datetime
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DOCKER = ['docker', '--host=unix:///var/run/docker.sock', 'exec', '-i', 'booking-repair-test']
ENV = {k: v for k, v in os.environ.items() if k not in (
    'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')}
DB = 'saas2_defaults_qa_' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S%f')
NAMES = "'get_group_availability','create_group_booking_hold','get_availability','create_booking_hold','saas_can_manage','consume_raiox_ai_quota','join_waitlist','offer_waitlist','cancel_waitlist'"
SIGNATURE = 'public.create_booking_hold(uuid,uuid,timestamptz,uuid[],text,text,text,boolean)'
PARAMETERS = """p_barbershop_id uuid,
p_barber_id uuid DEFAULT NULL::uuid,
p_starts_at timestamptz DEFAULT NULL::timestamptz,
p_service_ids uuid[] DEFAULT '{}'::uuid[],
p_customer_name text DEFAULT ''::text,
p_customer_phone text DEFAULT ''::text,
p_customer_email text DEFAULT NULL::text,
p_marketing_consent boolean DEFAULT false"""


def run(args, text=None, check=True):
    result = subprocess.run(DOCKER + args, input=text, capture_output=True, text=True, env=ENV)
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result


def sql(text, check=True, database=DB):
    return run(['psql', '-X', '-U', 'postgres', '-d', database, '-At',
                '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], text, check)


def catalog():
    return json.loads(sql(f"""SELECT coalesce(json_agg(row_to_json(x) ORDER BY x.identity),'[]') FROM (
    SELECT p.oid,p.oid::regprocedure::text AS identity,p.proname,p.proargnames,p.proargtypes::text AS types,
           pg_get_function_arguments(p.oid) AS arguments,pg_get_function_result(p.oid) AS result,
           p.pronargdefaults,p.prosecdef,p.proconfig,p.proacl::text AS acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ({NAMES})) x;""").stdout)


def fingerprint():
    return {table: sql(f"SELECT md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY id),'')) FROM public.{table} t;").stdout.strip()
            for table in ['customers', 'bookings', 'booking_items', 'payments', 'financial_transactions']}


# Fresh database, schema from an already isolated fixture, NEVER a data dump.
sql(f'CREATE DATABASE {DB} TEMPLATE template0;', database='postgres')
schema = run(['pg_dump', '-U', 'postgres', '-d', 'quick_booking_safe_qa', '--schema-only', '--no-owner']).stdout
sql(schema)
sql((ROOT / 'supabase/seed.sql').read_text())
sql("""INSERT INTO auth.users VALUES('99999999-9999-4999-8999-999999999999');
INSERT INTO public.shop_members(barbershop_id,user_id) VALUES('11111111-1111-1111-1111-111111111111','99999999-9999-4999-8999-999999999999');
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
INSERT INTO public.customers(id,barbershop_id,name,phone,email) VALUES('44444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','Fixture 42P13 sem dados reais','11900000001','fixture@example.test');
INSERT INTO public.bookings(id,barbershop_id,barber_id,customer_id,starts_at,ends_at,total_price,deposit_amount,status,hold_expires_at) VALUES
('55555555-5555-4555-8555-555555555551','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221','44444444-4444-4444-8444-444444444444',(current_date+60+time '09:00') AT TIME ZONE 'America/Sao_Paulo',(current_date+60+time '09:45') AT TIME ZONE 'America/Sao_Paulo',90,45,'hold',now()+interval '30 minutes'),
('55555555-5555-4555-8555-555555555552','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221','44444444-4444-4444-8444-444444444444',(current_date+60+time '10:00') AT TIME ZONE 'America/Sao_Paulo',(current_date+60+time '10:45') AT TIME ZONE 'America/Sao_Paulo',90,45,'confirmed',null);
INSERT INTO public.booking_items(booking_id,service_id,service_name,price,duration_minutes) SELECT id,'33333333-3333-3333-3333-333333333331','Serviço histórico de fixture',90,45 FROM public.bookings;
INSERT INTO public.payments(id,barbershop_id,booking_id,amount,method,status) VALUES
('66666666-6666-4666-8666-666666666661','11111111-1111-1111-1111-111111111111','55555555-5555-4555-8555-555555555551',45,'pix','pending'),
('66666666-6666-4666-8666-666666666662','11111111-1111-1111-1111-111111111111','55555555-5555-4555-8555-555555555552',45,'pix','approved');
INSERT INTO public.financial_transactions(barbershop_id,booking_id,payment_id,type,amount,description) VALUES('11111111-1111-1111-1111-111111111111','55555555-5555-4555-8555-555555555552','66666666-6666-4666-8666-666666666662','income',45,'Fixture sem recebimento real');""")
# Retain the pre-existing implementation/OID; change ONLY its header to match the reported production contract.
original = sql(f"SELECT pg_get_functiondef('{SIGNATURE}'::regprocedure);").stdout
sql('CREATE OR REPLACE FUNCTION public.create_booking_hold(' + PARAMETERS + ')' + original[original.index('\n RETURNS'):])
sql(f"REVOKE ALL ON FUNCTION {SIGNATURE} FROM PUBLIC; GRANT EXECUTE ON FUNCTION {SIGNATURE} TO anon,authenticated,service_role;")
sql("CREATE VIEW public.saas2_defaults_dependency_probe AS SELECT public.create_booking_hold('11111111-1111-1111-1111-111111111111'::uuid) AS result;")
before = catalog()
rows_before = fingerprint()
bundle = (ROOT / 'supabase/saas2-install.sql').read_text()
# Reproduce the old installer by removing exactly the defaults that caused production's failure.
broken_header = 'CREATE OR REPLACE FUNCTION public.create_booking_hold(p_barbershop_id uuid,p_barber_id uuid,p_starts_at timestamptz,p_service_ids uuid[],p_customer_name text,p_customer_phone text,p_customer_email text,p_marketing_consent boolean DEFAULT false)'
broken, replacements = re.subn(r'CREATE OR REPLACE FUNCTION public\.create_booking_hold\([\s\S]*?\)\nRETURNS jsonb', broken_header + '\nRETURNS jsonb', bundle, count=1)
assert replacements == 1
failure = sql(broken, check=False)
assert failure.returncode and '42P13' in failure.stderr, failure.stderr
assert 'cannot remove parameter defaults from existing function' in failure.stderr, failure.stderr
assert catalog() == before and fingerprint() == rows_before, 'Failed transaction must leave no partial installation'
print('PASS: old installer reproduces 42P13, transaction rolls back without changing rows or function OID.')

sql(bundle)
after = catalog()
old_by_identity = {r['identity']: r for r in before}
for row in after:
    old = old_by_identity.get(row['identity'])
    if old:
        for key in ['oid', 'proargnames', 'types', 'arguments', 'result', 'pronargdefaults']:
            assert row[key] == old[key], (row['identity'], key, old[key], row[key])
held = next(r for r in after if r['proname'] == 'create_booking_hold')
assert held['pronargdefaults'] == 7 and held['result'] == 'jsonb' and held['prosecdef']
assert held['acl'] == next(r for r in before if r['proname'] == 'create_booking_hold')['acl']
assert 'search_path=pg_catalog, public, extensions, pg_temp' in held['proconfig']
assert len(after) == 9
assert fingerprint() == rows_before, 'Installer changed existing bookings/payments/items/customers/ledger'
sql(bundle)
assert catalog() == after and fingerprint() == rows_before, 'Second installation must be idempotent'
print('PASS: fixed installer twice; seven defaults, names, return type, OIDs, grants and existing financial rows preserved.')

# The stored view dependency must survive; EXPLAIN does not execute the invalid business request.
sql('EXPLAIN SELECT * FROM public.saas2_defaults_dependency_probe;')
assert int(sql(f"SELECT count(*) FROM pg_depend WHERE refclassid='pg_proc'::regclass AND refobjid='{SIGNATURE}'::regprocedure;").stdout) > 0
arg_types = ['uuid','uuid','timestamptz','uuid[]','text','text','text','boolean']
for count in range(1, 9):
    sql(f"PREPARE arity_{count}({','.join(arg_types[:count])}) AS SELECT public.create_booking_hold({','.join('$'+str(i) for i in range(1,count+1))});")
sql("PREPARE by_name(uuid,timestamptz,uuid[],text,text) AS SELECT public.create_booking_hold(p_barbershop_id=>$1,p_starts_at=>$2,p_service_ids=>$3,p_customer_name=>$4,p_customer_phone=>$5);")
print('PASS: dependent view preserved; positional arities 1–8 and named optional arguments resolve without ambiguity.')
# An omitted argument may be SQL-valid while the business request remains invalid. Never bypass validation.
sql("""SET ROLE anon; DO $$ BEGIN
 BEGIN PERFORM public.create_booking_hold('11111111-1111-1111-1111-111111111111'::uuid);
 RAISE EXCEPTION 'Incomplete request accepted'; EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'Dados de contato inválidos.' THEN RAISE;END IF; END;
 END $$; RESET ROLE;""")
assert fingerprint() == rows_before
# A valid named request may omit barber/email/consent and still use normal allocation and prices.
sql(r"""BEGIN;
SET ROLE anon;
SELECT (current_date+7+CASE WHEN extract(dow from current_date+7)=0 THEN 1 ELSE 0 END)::text AS day \gset
SELECT start_time FROM public.get_availability('11111111-1111-1111-1111-111111111111',null,:'day',ARRAY['33333333-3333-3333-3333-333333333331']::uuid[]) ORDER BY start_time,barber_id LIMIT 1 \gset
SELECT public.create_booking_hold(p_barbershop_id=>'11111111-1111-1111-1111-111111111111'::uuid,p_starts_at=>:'start_time'::timestamptz,p_service_ids=>ARRAY['33333333-3333-3333-3333-333333333331']::uuid[],p_customer_name=>'Optional defaults fixture',p_customer_phone=>'11900000002') AS optional_result \gset
RESET ROLE;
SELECT set_config('qa.optional_booking',(:'optional_result'::jsonb->>'booking_id'),true);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=current_setting('qa.optional_booking')::uuid AND b.status='hold' AND b.hold_expires_at=now()+interval '15 minutes' AND b.total_price=(SELECT price FROM public.services WHERE id='33333333-3333-3333-3333-333333333331')) THEN RAISE EXCEPTION 'Valid optional call failed'; END IF;
IF EXISTS(SELECT 1 FROM public.consents c JOIN public.bookings b ON b.customer_id=c.customer_id WHERE b.id=current_setting('qa.optional_booking')::uuid) THEN RAISE EXCEPTION 'Omitted marketing consent must be false';END IF;END $$;
ROLLBACK;""")
assert fingerprint() == rows_before
print('PASS: valid named call omitting barber/email/consent creates normal 15-minute hold without marketing opt-in (rolled back).')
# All 9 catalog definitions, recorded dependencies and optional-overload conflicts, no data reads.
audit = sql((ROOT / 'supabase/saas2-function-audit.sql').read_text()).stdout
# Demonstrate ambiguous optional overloads safely within a transaction, then roll back the fixture only.
sql("""BEGIN;
CREATE FUNCTION public.create_booking_hold(p_barbershop_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb; $$;
DO $$ BEGIN BEGIN PERFORM public.create_booking_hold('11111111-1111-1111-1111-111111111111'::uuid);
RAISE EXCEPTION 'Expected optional overload ambiguity';EXCEPTION WHEN ambiguous_function THEN NULL;END;END $$;
ROLLBACK;""")
assert catalog() == after
sql((ROOT / 'supabase/tests/saas2.local.sql').read_text())
assert fingerprint() == rows_before
print('PASS: incomplete request rejected; no ambiguous overload left; booking/payment/RLS/FIFO regression passed.')
report = {'database':DB,'productionAccess':False,'syntheticDataOnly':True,'reproducedSQLSTATE':'42P13',
          'fixedInstallerAppliedTwice':True,'existingRowsPreserved':True,'dependencyPreserved':True,
          'positionalArities':list(range(1,9)),'namedOptionalCalls':True,'validOptionalHold':True,'rowFingerprintsBefore':rows_before,'rowFingerprintsAfter':fingerprint(),'functionsAudited':after,'catalogAudit':audit}
(ROOT / 'docs/saas-2/defaults-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Local evidence: docs/saas-2/defaults-validation.json')
