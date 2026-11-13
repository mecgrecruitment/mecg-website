// Runs once per Vercel build, never from a public request. Only synthetic inputs;
// bounded to nine requests, each capped at 3,000 output tokens, with no retries.
import { mkdir, writeFile } from 'node:fs/promises';
import { moduleKeys } from '../src/lib/consulting-workbench/schema.ts';
import { sampleProject } from '../src/lib/consulting-workbench/sample.ts';
import { selectProvider, requestSuggestions } from '../src/lib/consulting-workbench/provider.ts';
const provider = selectProvider({enabled:process.env.CONSULTING_AI_ENABLED,vercel:process.env.VERCEL,gatewayKey:process.env.AI_GATEWAY_API_KEY,gatewayModel:process.env.CONSULTING_GATEWAY_MODEL,directKey:process.env.CONSULTING_OPENAI_API_KEY,directModel:process.env.CONSULTING_OPENAI_MODEL},process.env.VERCEL_OIDC_TOKEN || null);
const checks=[];
if (process.env.VERCEL==='1' && provider) {
  for(const workflow of moduleKeys) {
    const project=sampleProject();
    // These are deliberately nonempty, realistic draft-generation tasks. The
    // validation below exercises the same schema and privilege stripping as runtime.
    project.question=`For the synthetic example, propose one useful NEW ${workflow} work item. Use evidence IDs from the input where relevant; do not repeat existing rows.`;
    const result=await requestSuggestions(provider,project,workflow);
    checks.push(result.ok ? {workflow,ok:true,draftRows:result.suggestions.tables.reduce((n,t)=>n+t.rows.length,0),inputTokens:result.inputTokens,outputTokens:result.outputTokens} : {workflow,ok:false,code:result.code,message:result.error});
    console.log('Consulting provider check',workflow,checks.at(-1).ok?'passed':checks.at(-1).code);
    // Authentication/billing failure applies to every module; do not burn eight retries.
    if(!result.ok && ['provider_http_401','provider_http_402','provider_http_403','provider_http_429'].includes(result.code))break;
  }
}
const status={version:1,commit:process.env.VERCEL_GIT_COMMIT_SHA || null,verifiedAt:new Date().toISOString(),provider:provider?.kind || null,model:provider?.model || null,ready:checks.length===moduleKeys.length && checks.every(c=>c.ok),checks,code:!provider?'no_platform_identity':checks.length===moduleKeys.length&&checks.every(c=>c.ok)?'verified':checks.length?'provider_check_failed':'not_run'};
await mkdir('public/.well-known',{recursive:true});await writeFile('public/.well-known/mecg-ai-provider.json',JSON.stringify(status,null,2)+'\n');
console.log('Consulting provider readiness:',status.ready?'verified for all nine workflows':status.code);
// Never promote a deployment whose real provider verification failed. The
// previous deployment stays live. Only sanitized codes appear in build errors.
if(process.env.VERCEL==='1' && !status.ready)throw new Error(`Consulting provider gate: ${status.code}; ${checks.find(c=>!c.ok)?.code || 'OIDC unavailable'}`);
