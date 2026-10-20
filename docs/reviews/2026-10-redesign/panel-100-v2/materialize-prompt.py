#!/usr/bin/env python3
"""Emit one complete fresh-agent task prompt. Never launches an agent."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('seat_id')
args = parser.parse_args()
base = Path(__file__).resolve().parent
manifest = json.loads((base / 'manifest.json').read_text())
if not (manifest.get('snapshotFinalized') and manifest.get('voterLaunchAuthorized') and manifest.get('snapshotId') and manifest.get('snapshotPath')):
    parser.error('V2 final snapshot and root launch authorization are required; no prompt or voter created.')
seat = next((s for s in json.loads((base / 'seats.json').read_text()) if s['seatId'] == args.seat_id), None)
if seat is None:
    parser.error('Unknown V2 seat ID')
if any(a.get('seatId') == args.seat_id and (a.get('taskId') or a.get('taskName')) and a.get('status') not in ['failed', 'cancelled', 'interrupted'] for a in manifest['attempts']):
    parser.error('This seat already has an accepted live/completed task; use its handle, never duplicate it.')
snapshot = Path(manifest['snapshotPath'])
frozen = snapshot / 'docs/reviews/2026-10-redesign/panel-100-v2'
required = ['BRIEF.md', 'ORIGINAL-BRIEF.md', 'prior-findings-and-responses.json', 'RESPONSES.md', 'UNRESOLVED.md', 'EVIDENCE-INDEX.md']
for name in required:
    if not (frozen / name).is_file():
        parser.error('Missing frozen review context: ' + name)
prior = json.loads((frozen / 'prior-findings-and-responses.json').read_text())
# Original matching ten-seat lens family supplies complete relevant historical
# objections inline; every other original objection remains in the required file.
number = int(seat['previousSeatId'].rsplit('-', 1)[1])
family_start = ((number - 1) // 10) * 10 + 1
relevant = [f for f in prior['findings'] if family_start <= int(f['sourceSeat'].rsplit('-', 1)[1]) < family_start + 10]
report = base / seat['report']
print(f'''You are a NEW independently instantiated AI acceptance reviewer for V2 seat {seat['seatId']}.
Lens: {seat['lens']}; kind: {seat['kind']}; angle: {seat['angle']}.
Focal task: {seat['task']}
You are not a human/Apple employee. Do not spawn agents or act externally.
Exact frozen path: {snapshot}
Exact snapshotId: {manifest['snapshotId']}
Write ONLY your own JSON report to: {report}
All source/evidence reads must use the frozen path; output is the sole permitted mutable report.
Read the complete frozen prior-findings-and-responses.json (all141 original objections), EVIDENCE-INDEX.md, RESPONSES.md and UNRESOLVED.md. Relevant prior objections and complete original/V2 briefs are also included below. Prior responses are claims to verify, not proof or vote guidance. Do not read other V2 votes or seek V1 verdicts as guidance.
Independently inspect the actual public proposition, factual/privacy boundaries, at least one actual user journey and your focal surface; view relevant captures for visual craft. No preferred answer: answer the unchanged broad world-class question honestly; conditional/missing evidence is not agree. Final response verdict and report path.

=== ORIGINAL USER REVIEW BRIEF (verbatim) ===
{(frozen / 'ORIGINAL-BRIEF.md').read_text()}
=== V2 REVIEW BRIEF ===
{(frozen / 'BRIEF.md').read_text()}
=== RELEVANT ORIGINAL FINDINGS AND HISTORICAL RESPONSES ===
{json.dumps(relevant, indent=2, ensure_ascii=False)}
=== UPDATED IMPLEMENTATION RESPONSES (verify independently) ===
{(frozen / 'RESPONSES.md').read_text()}
=== UNRESOLVED OBJECTIONS AND EVIDENCE LIMITS ===
{(frozen / 'UNRESOLVED.md').read_text()}
''')
