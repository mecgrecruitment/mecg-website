// Real two-session CAS proof. Only accepts the explicitly named disposable
// Docker database used by this goal's isolated verification, never a URL.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
const container = process.argv[2];
if (container !== "supabase_db_mecg-goal-20261016") throw new Error("Pass the dedicated local proof container name");
function sql(statement) {
  const child=spawn("docker",["exec","-i",container,"psql","-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At"],{stdio:["pipe","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout.on("data",c=>stdout+=c);child.stderr.on("data",c=>stderr+=c);
  child.stdin.end(statement);
  return once(child,"exit").then(([code])=>{assert.equal(code,0,stderr);return stdout.trim();});
}
const id="19000000-0000-4000-8000-000000000099";
const cycle="parallel-draft-proof";
const claims=JSON.stringify({iss:"https://parallel-draft.example.invalid",sub:id,role:"authenticated"});
const actor=`set local role authenticated; set local "request.jwt.claims"='${claims}';`;
try {
  await sql(`begin; update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK'); insert into auth.users(id,email,raw_user_meta_data) values ('${id}','parallel-draft@example.invalid','{}'); insert into rush.auth_identities(app_user_id,issuer,subject) values ('${id}','https://parallel-draft.example.invalid','${id}'); insert into rush.rush_cycles(id,name,status) values ('${cycle}','Synthetic parallel draft','OPEN'); commit;`);
  const requests=["A","B"].map((name,i)=>({name,mutation:`19000000-0000-4000-8000-00000000009${i+1}`}));
  const replies=await Promise.all(requests.map(({name,mutation})=>sql(`begin; ${actor} select rush.save_application_draft_v2('{"name":"${name}"}',null,'${mutation}','${cycle}'); select pg_sleep(0.25); commit;`)));
  const outcomes=replies.map((reply)=>JSON.parse(reply.split("\n").find(line=>line.startsWith("{"))));
  assert.equal(outcomes.filter(o=>o.kind==="saved").length,1);
  assert.equal(outcomes.filter(o=>o.kind==="conflict").length,1);
  const winner=requests[outcomes.findIndex(o=>o.kind==="saved")];
  const persisted=await sql(`begin; ${actor} select rush.application_draft(); rollback;`);
  const draft=JSON.parse(persisted.split("\n").find(line=>line.startsWith("{")));
  assert.equal(draft.name,winner.name);
  const saved=outcomes.find(o=>o.kind==="saved");
  assert.equal(draft.revision,saved.revision);
  console.log(JSON.stringify({status:"passed",parallelSessions:2,saved:1,conflicts:1,winnerPersisted:true}));
} finally {
  // All resources belong to this isolated synthetic fixture; no linked DB access.
  await sql(`begin; delete from rush.applications where cycle_id='${cycle}'; delete from rush.audit_events where cycle_id='${cycle}'; delete from rush.rush_cycles where id='${cycle}'; delete from rush.pnms where auth_user_id='${id}'; delete from auth.users where id='${id}'; delete from rush.profiles where id='${id}'; commit;`).catch(error=>{console.error("Isolated fixture cleanup failed",error.message);process.exitCode=1;});
}
