// Run with: node --import ./scripts/esm-loader.mjs scripts/consulting-check.mjs PROJECT.json TOOL YYYY-MM-DD [OUTPUT.md]
import { readFile, writeFile } from 'node:fs/promises';
import { parseProject, isModule } from '../src/lib/consulting-workbench/schema.ts';
import { analyze, exportReport } from '../src/lib/consulting-workbench/engine.ts';
const [file, workflow, asOf, output, ...extra] = process.argv.slice(2);
if (!file || !isModule(workflow) || !asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0,10) !== asOf || extra.length) {
  console.error('Usage: node --import ./scripts/esm-loader.mjs scripts/consulting-check.mjs PROJECT.json TOOL YYYY-MM-DD [NEW_OUTPUT.md]'); process.exitCode=2;
} else {
  try {
    const bytes = await readFile(file); if (bytes.length > 600_000) throw new Error('Project import is limited to 600 KB.');
    const parsed = parseProject(JSON.parse(bytes.toString('utf8'))); if (!parsed.ok) throw new Error(parsed.error);
    const result = analyze(parsed.value,workflow,asOf); const report = exportReport(parsed.value,result,asOf);
    if (output) await writeFile(output,report,{flag:'wx'}); else process.stdout.write(report+'\n');
    // Attention is not a pass; a human must review output regardless of this code.
    if (result.findings.some(f=>f.severity==='blocker'))process.exitCode=1;
  } catch (error) {console.error(error instanceof Error?error.message:'Unable to check project');process.exitCode=2;}
}
