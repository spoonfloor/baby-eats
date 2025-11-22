UX SPEC + CURRENT STATUS

---

## STRUCTURE & LINE TYPES

Two-level hierarchy only
Spec: Instructions are represented as a flat, ordered list of lines with exactly two types: `heading` (level 0) and `step` (level 1, numbered). No deeper nesting.
Status: `TBD`

Heading lines
Spec: Heading lines are unnumbered, structural labels (e.g., “FILLING”) that visually separate groups of steps. They are stored as plain text (not forced uppercase) and rendered in a distinct style.
Status: `TBD`

Step lines
Spec: Step lines are numbered instructions that follow headings or other steps. Numbers are derived from the line order, not stored text.
Status: `TBD`

Numbering model
Spec: Step numbers recompute from top to bottom, ignoring headings; each contiguous run of steps is numbered 1, 2, 3, … based on visual order.
Status: `PASS`

---

## TAB / SHIFT+TAB

Heading + TAB → convert to step
Spec: Pressing TAB at the start of a heading converts it into a step and renumbers the surrounding steps. Example:

- Before:

  - `filling`
  - `1. foo`
  - `2. bar`
  - `3. baz`

- After TAB on “filling”: - `1. filling` - `2. foo` - `3. bar` - `4. baz`
  Status: `TBD`

Step + SHIFT+TAB → convert to heading
Spec: Pressing SHIFT+TAB at the start of a step converts that line into a heading. Steps below it may become a new numbered run under that heading. Example:

- Before:

  - `filling`
  - `1. foo`
  - `2. bar`
  - `3. baz`

- After SHIFT+TAB on “bar”: - `filling` - `1. foo` - `bar` (now a heading) - `1. baz` (first step under new heading)
  Status: `TBD`

No deeper indentation
Spec: TAB on a step (already level 1) is a no-op. SHIFT+TAB on a heading (already level 0) is a no-op. There is no level 2 or beyond.
Status: `TBD`

---

## ENTER

Start-of-line
Spec: Pressing Return at the start of a line moves the caret and any content down to a new line, leaving a blank line above (blank step is real).
Status: `FAIL` - Caret stays with the blank line above

Mid-line
Spec: Split step; right side becomes new step below; caret moves to start of new step
Status: `PASS`

End-of-line
Spec: Insert blank step below; caret moves there
Status: `PASS`

---

## BLANK STEPS

Blank steps are real steps during editing
Spec: Blank steps should exist as true steps during editing
Status: `PASS`

Blank steps are clickable
Spec: Caret can be placed (via click) into a blank line
Status: `PASS`

Blank steps persist after committing (BLUR or SAVE)
Spec: All created blank steps should remain after BLUR or SAVE
Status: `PASS`

Blank steps removed only by explicit deletion or ESC/CANCEL
Spec: Blank steps should only disappear via delete or ESC/CANCEL
Status: `PASS`

---

## MERGE / BACKSPACE

Backspace at index 0 merges with previous step
Spec: Merge previous step into current; caret preserved intuitively
Status: `PASS`

Split/Merge reversible via ESC during session
Spec: ESC should undo split/merge operations done in this edit session
Status: `PASS`

---

## ESC

Single ESC only
Spec: One ESC press should revert changes (no double-ESC)
Status: `PASS`

ESC discards all changes since last SAVE and exits editing
Spec: ESC should fully revert to last saved state and exit edit mode
Status: `PASS`

ESC removes all blank steps created during the edit session
Spec: Temporary blank steps must be removed on ESC
Status: `PASS`

---

## BLUR, SAVE, COMMIT

Blur commits edits and exits edit mode
Spec: BLUR should commit edits to in-memory/session state and exit edit mode
Status: `PASS`

SAVE persists to DB; BLUR only commits in memory/UI
Spec: SAVE writes to DB; BLUR commits only to UI/session state
Status: `PASS`

---

## EDITING + ACTIVE STEP + REORDER

Reordering is allowed during editing
Spec: User can reorder steps without exiting edit mode
Status: `PASS`

Caret stays in same logical position after reorder
Spec: Caret must not jump unexpectedly after reordering
Status: `PASS`

Clicking makes a step active at caret position
Spec: Clicking anywhere in a step should place caret exactly there
Status: `PASS`

Step numbers update live on structural changes
Spec: Step numbers must re-render correctly after inserts, deletes, etc.
Status: `PASS`

---

## INGREDIENTS PARALLEL STRUCTURE

Ingredients hierarchy
Spec: Ingredients list can optionally use the same two-level model as instructions: headings for groups (e.g., “FILLING”, “CASHEW CREAM”) plus ingredient lines under each heading.
Status: `TBD`

Ingredients TAB / SHIFT+TAB (if implemented)
Spec: Ingredients headings and lines follow the same TAB/SHIFT+TAB behavior as instructions, maintaining consistency between the two editors.
Status: `TBD`
