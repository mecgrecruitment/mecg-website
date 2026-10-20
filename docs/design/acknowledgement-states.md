# Acknowledgement and recovery states

2026-10-16. These diagrams describe the current implementation. They are engineering review aids, not hosted acceptance evidence or panel votes. See `../reviews/2026-10-redesign/submission-receipts-and-deadlines.md` for actual verification.

## Applicant submission

```mermaid
flowchart TD
  A[Review and explicitly submit] --> B[Lock edits; send revision and cycle]
  B --> C{Bounded full response}
  C -->|Valid application ID| D[Clear recovery; navigate with receipt ID]
  C -->|Lost, timeout, malformed success or server error| E[Read owned status for the same cycle]
  E -->|Valid ID and submitted state| D
  E -->|Unconfirmed, malformed or another cycle| F[Keep answers and recovery; explain uncertainty]
  C -->|Revision conflict| G[Keep both copies; explicit conflict recovery]
  C -->|Definitive client rejection| H[Keep answers; explain correction]
  D --> I[Dashboard independently checks stored submission before receipt banner]
```

HTTP success alone is not a receipt. A prior cycle's submission cannot confirm this form. A negative status read does not prove the attempted write failed.

## Closing grading

```mermaid
flowchart TD
  A[Load authorized coverage] --> B[Explicit close confirmation]
  B --> C[Store browser pending marker; send close]
  C --> D[Read authoritative round status after any acknowledgement]
  D -->|Frozen, finalized or archived| E[Confirm closed; clear marker; disable repeat close]
  D -->|Explicit rejection and active status| F[Clear marker; fresh coverage and explicit confirmation]
  D -->|Every other result| G[Unknown outcome; keep marker; no repeat write]
  G --> H[Check status again without writing]
  H --> D
  G --> I[Dismiss or reload in the same tab]
  I -->|Recovery marker available| G
```

The recovery marker is browser storage, not a server operation ledger. It can be unavailable or cleared. An active read by itself cannot resolve an ambiguous write: that transaction may still commit. Local and cross-engine fixtures exercise these states; hosted permissions, transactions, sessions and actual operator acceptance remain separate checks.


## Evaluator recovery

```mermaid
flowchart TD
  Load[Read server draft and same-tab backup] --> Compare{Both copies differ?}
  Compare -->|Yes| Pause[Preserve both; pause editing and writes]
  Pause --> Inspect[Compare ratings, notes and evidence; download either]
  Inspect --> Browser[Explicitly recover browser copy]
  Inspect --> Server[Explicitly select server copy]
  Browser --> Sync[Sync selected draft with a bounded wait]
  Server --> Backup[Replace browser backup with selected server copy]
  Compare -->|No| Edit[Continue editing]
  Backup --> Edit
  Sync --> Edit
  Edit --> Local{Exact browser write confirmed?}
  Local -->|Yes| LocalReceipt[Current same-tab backup]
  Local -->|No| ServerCheck{Exact server version confirmed?}
  ServerCheck -->|Yes| ServerReceipt[Server copy saved; local backup unavailable]
  ServerCheck -->|No| Memory[Memory only; download before leaving]
```

Copies are selected, not automatically merged. Local backup retention is up to24hours in the current tab. A timestamp receipt acknowledges a server save, not a revision/CAS guarantee against concurrent server writers.

## Combining application copies

```mermaid
stateDiagram-v2
    [*] --> Comparing: Browser differs or revision conflict
    Comparing --> PrivateBackup: Download both copies
    PrivateBackup --> Comparing: Check local download
    Comparing --> Choosing: Select saved/browser version per changed field
    Choosing --> Editing: Continue with combined answers
    Comparing --> Editing: Explicit whole-copy choice
    Editing --> Saving: Consent cleared; reviewed revision retained
    Saving --> Editing: Confirmed new revision
    Saving --> Comparing: Another concurrent change
    Saving --> Uncertain: Receipt unavailable
    Uncertain --> Saving: Retry the exact mutation
```

No write occurs while comparison is unresolved. A private export does not submit the application or download attachment bytes. A combination chooses exact existing text; it does not infer which copy is newer or rewrite responses.
