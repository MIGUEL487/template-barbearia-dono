"""Disposable Docker PostgreSQL ONLY, never a Supabase connection."""
import os, subprocess, concurrent.futures, json
base=['docker','--host=unix:///var/run/docker.sock','exec','booking-repair-test','psql','-U','postgres','-d','saas2_qa','-At','-v','ON_ERROR_STOP=1','-c']
env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
def sql(q):
 r=subprocess.run(base+[q],capture_output=True,text=True,env=env)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
shop='11111111-1111-1111-1111-111111111111';barber='22222222-2222-2222-2222-222222222221';service='33333333-3333-3333-3333-333333333331'
date=sql("SELECT (current_date+21+CASE WHEN extract(dow from current_date+21)=0 THEN 1 ELSE 0 END)::text")
entry=sql(f"SET ROLE anon; SELECT public.join_waitlist('{shop}','{barber}',ARRAY['{service}']::uuid[],'{date}','09:00','19:00','SAAS2CONCURRENCY','11977776666',null,'phone',true);").splitlines()[-1]
start=sql(f"SELECT start_time FROM public.get_availability('{shop}','{barber}','{date}',ARRAY['{service}']::uuid[]) ORDER BY start_time LIMIT 1")
assert start, 'Fixture needs a future slot'
call=f"SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);SET ROLE authenticated;SELECT public.offer_waitlist('{shop}','{entry}','{barber}','{start}');"
try:
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda _:sql(call),range(2)))
 parsed=[json.loads(r.splitlines()[-1]) for r in results]
 assert len({r['booking_id'] for r in parsed})==1, 'Duplicate booking IDs'
 assert sum(bool(r.get('already_offered')) for r in parsed)==1, 'One request must receive existing result'
 assert sql("SELECT count(*) FROM bookings b JOIN customers c ON b.customer_id=c.id WHERE c.name='SAAS2CONCURRENCY'")=='1'
 print('PASS: two concurrent offers produced exactly one hold; second response idempotent.')
finally:
 sql("DELETE FROM waitlist_entries WHERE customer_name='SAAS2CONCURRENCY';DELETE FROM payments WHERE booking_id IN(SELECT b.id FROM bookings b JOIN customers c ON b.customer_id=c.id WHERE c.name='SAAS2CONCURRENCY');DELETE FROM booking_items WHERE booking_id IN(SELECT b.id FROM bookings b JOIN customers c ON b.customer_id=c.id WHERE c.name='SAAS2CONCURRENCY');DELETE FROM bookings WHERE customer_id IN(SELECT id FROM customers WHERE name='SAAS2CONCURRENCY');DELETE FROM customers WHERE name='SAAS2CONCURRENCY';")
