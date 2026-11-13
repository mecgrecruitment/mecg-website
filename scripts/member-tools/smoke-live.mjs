const base='https://mecgmichigan.com';
const report={};
const health=await fetch(`${base}/api/health`); const body=await health.json();
report.health={status:health.status,ok:body.ok};
if(!health.ok||body.ok!==true) throw new Error('Production health failed');
report.pages=[];
for(const tool of ['pipeline','evidence','lab']) {
 const response=await fetch(`${base}/member/tools/${tool}`,{redirect:'manual'});
 const location=response.headers.get('location');
 report.pages.push({tool,status:response.status,location});
 if(![302,303,307,308].includes(response.status)||!location||new URL(location,base).pathname!=='/login') throw new Error(`Anonymous page protection failed: ${tool}`);
}
const api=await fetch(`${base}/api/member/tools`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',redirect:'manual'});
report.api={status:api.status};if(api.status!==401) throw new Error('Anonymous write was not denied');
const {execFileSync}=await import('node:child_process');
let keys;
try { keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref','chrxtsohxazngabdcpzb','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch { throw new Error('Could not load the project publishable key for the REST check'); }
const key=keys.find(item=>item.type==='publishable')?.api_key;
if(typeof key!=='string') throw new Error('Project publishable key missing');
const headers={apikey:key,'Content-Type':'application/json','Content-Profile':'rush','Accept-Profile':'rush'};
const rpc=await fetch('https://chrxtsohxazngabdcpzb.supabase.co/rest/v1/rpc/member_tool_workspace',{method:'POST',headers,body:JSON.stringify({c:'anonymous-smoke-no-cycle',k:'pipeline'})});
const rpcBody=await rpc.json();report.rpc={status:rpc.status,code:rpcBody.code};
if(![401,403].includes(rpc.status)||rpcBody.code!=='42501') throw new Error(`Unexpected anonymous RPC response: ${JSON.stringify(report.rpc)}`);
const table=await fetch('https://chrxtsohxazngabdcpzb.supabase.co/rest/v1/member_tool_records?select=id&limit=0',{headers});
const tableBody=await table.json();report.table={status:table.status,code:tableBody.code};
if(![401,403].includes(table.status)||tableBody.code!=='42501') throw new Error(`Unexpected anonymous table response: ${JSON.stringify(report.table)}`);
console.log(JSON.stringify(report,null,2));
