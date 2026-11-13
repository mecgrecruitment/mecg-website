// Read-only release preflight; no member/client records or credentials printed.
import { readFileSync, readdirSync } from 'node:fs';
const ref = 'chrxtsohxazngabdcpzb';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `select version from supabase_migrations.schema_migrations order by version` }),
});
if (!response.ok) throw new Error(`Migration inspection failed: HTTP ${response.status}`);
const rows = await response.json();
if (!Array.isArray(rows) || rows.some(row => typeof row.version !== 'string')) throw new Error('Invalid migration ledger response');
const remote = rows.map(row => row.version);
const local = readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).map(name=>name.split('_')[0]);
console.log(JSON.stringify({ localOnly:local.filter(v=>!remote.includes(v)), remoteOnly:remote.filter(v=>!local.includes(v)) },null,2));
const dependencyResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({query:`select proname, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rush' and p.proname in ('actor_id','has_cycle_role')`}),
});
if (!dependencyResponse.ok) throw new Error(`Dependency inspection failed: HTTP ${dependencyResponse.status}`);
const dependencies=await dependencyResponse.json();
if (!Array.isArray(dependencies) || dependencies.length!==2 || !dependencies.every(row=>typeof row.definition==='string')) throw new Error('Identity dependency missing');
console.log(JSON.stringify(dependencies,null,2));
// Keep source loading explicit so a missing migration cannot go unnoticed.
if(!readFileSync('supabase/migrations/20261112120000_member_operations_tools.sql','utf8').includes('create table rush.member_tool_records')) throw new Error('Tool migration missing');
