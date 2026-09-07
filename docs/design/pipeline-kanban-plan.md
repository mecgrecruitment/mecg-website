# Recruitment pipeline Kanban

Status: first production slice implemented

## The current problem

The **By stage** screen has columns, but each card contains a status select and a **Move** button. The controls overflow narrow cards, hide the applicant's useful state, and make every move a two-step form submission. The board reads like Kanban and behaves like a set of forms.

The new board makes stage movement direct without treating drag and drop as the only control.

## Three interaction sketches

### A. Drag-only board

```text
[ Application in ]   [ Passed first read ]
  Alexis Miller   ->   drop here
```

The whole card drags between columns. This is fast with a mouse. It fails on touch when the user wants to scroll, and it gives keyboard users no obvious alternative. A failed server update also needs a recovery action outside the gesture.

### B. Command board

```text
[ Alexis Miller ] [ Move to... v ]
```

Every card opens a stage menu. This works on every device and makes legal destinations clear. It is also the interaction the current screen already has. A command board does not answer the request for a Kanban workflow.

### C. Hybrid Kanban

```text
[:: Alexis Miller ]  ->  [ Passed first read ]
    Resume on file       [ Move to... v ]
```

The grip supports pointer and keyboard drag on screens wide enough to show adjacent columns. The **Move to** control remains on every card. Both paths call the same API and obey the same legal transition list.

Use the hybrid. Drag makes the common desktop action fast. The menu handles mobile, accessibility, and recovery.

## GitHub package choice

The board needs vertical cards that move between horizontal lists. It also contains links, selects, and buttons inside each card.

| Package | Fit | Decision |
| --- | --- | --- |
| `@dnd-kit/react` | Pointer, touch, keyboard, grids, and custom collision rules | Do not use yet. The current React adapter is pre-1.0, and this board does not need its extra flexibility. |
| `@atlaskit/pragmatic-drag-and-drop` | Small, framework-neutral core used in Trello and Jira | Do not use here. The low-level API makes us own more accessibility and list behavior. |
| `@hello-pangea/dnd` | React 19 support, movement between lists, keyboard and screen-reader controls, touch, SSR, and nested controls | Use version `18.0.1`. It matches this board and removes the least-tested custom code. |

Sources:

- <https://github.com/clauderic/dnd-kit>
- <https://github.com/atlassian/pragmatic-drag-and-drop>
- <https://github.com/hello-pangea/dnd>

## Board behavior

### Drag only to legal stages

When a user lifts a card, highlight legal destination columns and mute the others. Use `legalManualApplicationStatuses()` on the client for feedback. Keep the database function as the authority.

Dropping a card does this:

1. Move the card immediately in local state.
2. Mark the card **Moving** and disable its second move.
3. Send `SET_APPLICATION_STATUS` to `/api/admin/rush`.
4. Keep the new stage when the server accepts the move.
5. Return the card to its source and show the server-safe error when the server rejects the move.

Do not add fake undo. Application status transitions are directional, and the database can reject a move back. A visible confirmation and audit history are more honest.

### Keep card movement separate from opening a file

Use a dedicated grip as the drag handle. The applicant name remains a normal link. The status menu, photo, and resume state remain clickable without starting a drag.

The grip is at least 40 by 40 pixels on desktop. Hide it below the board breakpoint because dragging between vertically stacked mobile columns is slower than the menu.

### Make columns useful

Each column needs:

- a sticky stage name and tabular count;
- a minimum empty height so it remains a drop target;
- a clear empty state that changes to **Drop here** during a legal drag;
- its own vertical scroll when the board is tall;
- a visible insertion placeholder;
- a muted state when the current card cannot enter that stage.

Use cards at least 240 pixels wide. The current 190-pixel minimum squeezes the status select and button outside the card.

### Make moves understandable

After a successful move, announce "Alexis moved to Passed first read" in a polite live region. After a failed move, announce the error as an alert and restore keyboard focus to the card's grip.

The card's visible state must match the database after `router.refresh()`. Ignore stale responses from an older move.

## Better cards

The first version keeps the current data. A later version should add only signals that change the next action:

- **Waiting 3 days** for `NEEDS_INFO`;
- **Missing resume**;
- **First read 2 of 3**;
- **Interview 1 of 2 submitted**;
- **Conflict or replacement needed**;
- the next required action and due time.

Do not put email addresses, rubric scores, or full reviewer notes on the board. Open the applicant file for those details.

## Filters and scale

Keep search above the board. Add these filters only when the data exists:

- needs action;
- owner or reviewer;
- missing document;
- days in stage;
- referred applicant.

Show active stages by default. Keep decided applicants collapsed below the board. Do not create columns for outcomes mixed with work in progress.

For more than 100 visible cards, render a fixed number per column with **Show more**. Dragging and six full DOM lists should not make the Recruitment page slow.

## Best follow-up upgrades

Add these only after the basic board has been used in one live recruiting cycle:

1. Put a plain-language stage definition and expected next action in each column header.
2. Add a **Needs action** filter driven by missing documents, overdue follow-up, or missing evaluator coverage.
3. Show **Waiting N days** on cards that exceed a Board-configured target for the current stage.
4. Add multi-select and a reviewed bulk move for administrative cleanup. Never make bulk drag a hidden gesture.
5. Let operators save personal views such as **My first reads** or **Missing resumes** without changing the shared board.
6. Add a compact activity receipt so an operator can confirm who moved a card and when without opening the audit log.

Do not add manual card ordering until the database stores a stable rank per stage. A visual order that disappears on refresh would make the board feel broken.

## Mobile behavior

On a phone, show one stage at a time with a stage selector and previous or next controls. Keep the **Move to** control on the card. Do not make a user drag a card through several screen heights.

The first production change keeps the existing stacked columns and hides drag grips on small screens. The one-stage mobile view is a separate change because it alters navigation and URL state.

## Failure and concurrency states

Test these cases:

- the server rejects a transition that the client believed was legal;
- another operator moves the applicant first;
- the user drops the card outside a column;
- the network stops after the optimistic move;
- search hides the source or destination during a drag;
- a keyboard user cancels a lifted card;
- a column starts empty;
- a card contains a focused link or select;
- two cards move at the same time in separate browser tabs.

The first version permits one pending move per card. The server remains responsible for transition validity and audit logging.

## Acceptance checks

- A mouse user moves an applicant between adjacent legal stages with one drag.
- A keyboard user lifts, moves, drops, and cancels a card.
- A touch user can move the same applicant without dragging.
- Illegal columns do not accept a drop.
- A failed move returns the card to its source.
- Search and decided-state controls keep working.
- Card controls do not overflow a 240-pixel column.
- Every move uses the existing guarded API.
- Screen readers hear lift, destination, drop, success, and failure states.
- Reduced-motion users do not receive custom movement effects.
