"""Fixed LOCAL Docker/PostgreSQL target. Source contains synthetic fixtures only."""
import os,subprocess,json,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[1]
env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
base=['docker','--host=unix:///var/run/docker.sock','exec','-i','booking-repair-test','psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-At']
source=json.loads((root/'docs/saas-2/defaults-validation.json').read_text())['database'];assert source.startswith('saas2_defaults_qa_')
db='saas3_qa_'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
def sql(text,database=db):
 r=subprocess.run(base+['-d',database],input=text,text=True,capture_output=True,env=env)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout
sql(f'CREATE DATABASE {db} TEMPLATE {source};','postgres')
script=(root/'supabase/migrations/20261106000000_saas3_experience.sql').read_text()
sql(script);sql(script)
print('PASS: SaaS 3 SQL applied twice locally:',db)
sql((root/'supabase/tests/saas2.local.sql').read_text());print('PASS: legacy hold, availability, verified payment and waitlist regression')
if (root/'supabase/tests/saas3.local.sql').exists():sql((root/'supabase/tests/saas3.local.sql').read_text());print('PASS: ledger, chat, reports, permissions and isolation tests')
(root/'docs/saas-3/database-results.json').write_text(json.dumps({'database':db,'sourceSyntheticOnly':True,'productionAccess':False,'idempotentInstallation':True},indent=2)+'\n')
