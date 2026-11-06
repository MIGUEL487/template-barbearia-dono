"""Private local preparation and auth-only verification. Never mutates provider config."""
import argparse,datetime,json,os,secrets,sys,tempfile,urllib.request,urllib.error
from pathlib import Path
PROJECT='jrzabortkpouqkwndpcq'
ENDPOINT=f'https://{PROJECT}.supabase.co/functions/v1/send-booking-push'
def secure_dir(value):
 p=Path(value).resolve()
 repo=Path(__file__).resolve().parents[1]
 if p==repo or repo in p.parents:raise ValueError('Use a private directory outside the repository.')
 if os.name!='posix':raise ValueError('Run inside WSL, Linux or macOS to enforce private file permissions.')
 if not p.is_dir() or p.stat().st_mode&0o077:raise ValueError('Private directory must exist with permissions 700.')
 return p

def create():
 if os.name!='posix':raise ValueError('Run inside WSL, Linux or macOS.')
 p=Path(tempfile.mkdtemp(prefix='auto-stilo-webhook-rotation-'));os.chmod(p,0o700)
 key=secrets.token_hex(32)
 created=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
 files={'next.env':f'BOOKING_WEBHOOK_SECRET_NEXT={key}\n','primary.env':f'BOOKING_WEBHOOK_SECRET={key}\n','scheduler.stdin':key+'\n','metadata.json':json.dumps({'createdAt':created,'bits':256,'productionConfigured':False},indent=2)+'\n'}
 for name,text in files.items():
  fd=os.open(p/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as f:f.write(text)
 print('Private files created. Secret value was not printed. Directory: '+str(p))

def verify(directory):
 p=secure_dir(directory)
 f=p/'scheduler.stdin'
 if f.is_symlink() or f.stat().st_mode&0o077:raise ValueError('Secret file must have permissions 600 and not be a symlink.')
 key=f.read_text().strip()
 if len(key)!=64 or any(c not in '0123456789abcdef' for c in key):raise ValueError('Invalid private file format.')
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*args,**kwargs):return None
 request=urllib.request.Request(ENDPOINT,data=b'{"type":"ROTATION_AUTH_PROBE"}',headers={'Content-Type':'application/json','x-booking-webhook-secret':key},method='POST')
 # This intentionally invalid event is rejected after authentication and before DB/push.
 try:
  urllib.request.build_opener(NoRedirect()).open(request,timeout=15)
 except urllib.error.HTTPError as e:
  data=e.read(1024)
  if e.code==400 and json.loads(data)=={'error':'Invalid booking event'}:
   print('PASS: new secret accepted. Auth-only probe; database and push not exercised.');return
  print('FAIL: auth-only probe returned HTTP '+str(e.code)+'. Response body omitted.');sys.exit(1)
 raise ValueError('Unexpected probe response; no production migration has been confirmed.')

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['create','verify-next']);parser.add_argument('--directory');args=parser.parse_args()
 if args.command=='create':create()
 elif args.directory:verify(args.directory)
 else:parser.error('--directory is required for verify-next')
if __name__=='__main__':
 try:main()
 except Exception:
  print('Operation failed. No secret values, headers or response bodies were logged.',file=sys.stderr);sys.exit(1)
