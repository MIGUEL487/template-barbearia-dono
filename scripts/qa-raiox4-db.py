"""Only local Docker PostgreSQL with synthetic fixtures. Never production."""
import os,subprocess,json,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[1]
env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
base=['docker','--host=unix:///var/run/docker.sock','exec','-i','booking-repair-test','psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-At']
def sql(text,db='postgres'):
 r=subprocess.run(base+['-d',db],input=text,text=True,capture_output=True,env=env)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout
source=sql("SELECT datname FROM pg_database WHERE datname LIKE 'saas3_qa_%' ORDER BY datname DESC LIMIT 1").strip();assert source.startswith('saas3_qa_')
db='raiox4_qa_'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
sql(f'CREATE DATABASE {db} TEMPLATE {source};')
sql((root/'supabase/migrations/20261031000000_booking_push.sql').read_text(),db)
script=(root/'supabase/raiox4-install.sql').read_text();sql(script,db);sql(script,db)
sql((root/'supabase/tests/raiox4.local.sql').read_text(),db)
sql((root/'supabase/tests/saas2.local.sql').read_text(),db)
sql((root/'supabase/tests/saas3.local.sql').read_text(),db)
(root/'docs/raiox4/database-results.json').write_text(json.dumps({'database':db,'sourceSyntheticOnly':True,'productionAccess':False,'idempotentInstallation':True,'ownPreferences':True,'tenantIsolation':True,'anonymousDenied':True,'pushClaims':True,'legacyBookingPaymentLedgerRegression':True},indent=2)+'\n')
print('PASS: SQL twice, RLS, tenant isolation, push claims and legacy regression:',db)
