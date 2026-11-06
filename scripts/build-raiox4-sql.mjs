import {readFileSync,writeFileSync} from 'node:fs';
const target='supabase/raiox4-install.sql';
const text='-- Auto Stilo Raio-X 4.0. Manual upgrade after SaaS 2/3 and booking-push.\n'+readFileSync('supabase/migrations/20261107000000_raiox4_reports.sql','utf8');
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==text)throw Error('Regenerate raiox4-install.sql');console.log('Raio-X 4 SQL synchronized')}else writeFileSync(target,text);
