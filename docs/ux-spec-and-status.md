# UX SPEC + CURRENT STATUS

---

## STRUCTURE & LINE TYPES

Two-level hierarchy only  
Spec: Instructions are represented as a flat, ordered list of lines with exactly two types: `heading` (level 0) and `step` (level 1, numbered). No deeper nesting.  
Status: `PASS`

Heading lines  
Spec: Heading lines are unnumbered, structural labels (e.g., “FILLING”) that visually separate groups of steps. They are stored as plain text (not forced uppercase) and rendered in a distinct style.  
Status: `PASS`

Step lines  
Spec: Step lines are numbered instructions that follow headings or other steps.  
Numbers are **derived**, not stored.  
Status: `PASS`

Numbering model  
Spec: Step numbers are **grouped**.  
Each heading starts a **new numbering group**.  
Steps within each group number **1, 2, 3 …** based on visual order.  
If the document begins with steps (no heading), those steps form an implicit first group.  
Status: `PASS`

---

## TAB / SHIFT+TAB

SHIFT+TAB — promote step → heading  
Spec:

- Convert line to `type = heading`.
- Remove number.
- Align heading text with the number column.
- While the line is being edited:
  - Editing color applies (per global visual rules).
  - Heading color is fully suppressed, even though the line is now `type = heading`.
- After BLUR:
  - Editing color is removed.
  - Heading color applies based on `type = heading`.
- **Steps below form a new numbering group, starting at 1.**
- Caret position stays in place.  
  Status: `PASS`

TAB — demote heading → step  
Spec:

- Convert line to `type = step`.
- Restore normal step indent.
- While the line is being edited:
  - Editing color applies (per global visual rules).
  - Step-at-rest color is suppressed, even though the line is now `type = step`.
- After BLUR:
  - Editing color is removed.
  - Step text color reverts to normal step color.
- **Demoting merges this line into the previous numbering group, and steps renumber within that group starting at 1.**
- Caret position stays in place.  
  Status: `PASS`

No-op cases  
Spec:

- TAB on a step is a no-op.
- SHIFT+TAB on a heading is a no-op.
- No deeper nesting exists beyond heading (level 0) and step (level 1).  
  Status: `PASS`

Visual / color rules  
Spec:

- Headings (at rest):

  - Unnumbered.
  - Use the heading text color variable.
  - Aligned with number column.

- Steps (at rest):

  - Numbered.
  - Use the normal step text color variable.

- While editing (both headings and steps):

  - Editing color applies unconditionally.
  - Heading/step colors are fully suppressed during editing.
  - Matches CSS:  
    `.instruction-line.editing .step-text` overrides base colors.

- After BLUR:

  - Editing color is removed.
  - Heading/step colors re-apply based on `type`.

- Renumbering:
  - **Step numbers restart after every heading (new numbering group).**
  - Steps within each group number 1, 2, 3 … in visual order.
    Status: `PASS`

---

## ENTER

Start-of-line  
Spec: Pressing Return at the start of a line moves the caret and any content down to a new line, leaving a blank line above (blank step is real).  
Status: `FAIL` — caret currently stays with the blank line above

Mid-line  
Spec: Split step; right side becomes a new step below; caret moves to start of new step  
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
Spec: Blank steps should only disappear via delete or ESC  
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
Spec: BLUR should commit edits to in-memory/session state only  
Status: `PASS`

SAVE persists to DB; BLUR does not  
Spec: SAVE writes to DB; BLUR commits only to UI/session state  
Status: `PASS`

---

## EDITING + ACTIVE STEP + REORDER

Reordering allowed during editing  
Spec: User can reorder steps without exiting edit mode  
Status: `PASS`

Caret stays in same logical position after reorder  
Spec: Caret must not jump unexpectedly  
Status: `PASS`

Clicking makes a step active at caret position  
Spec: Clicking anywhere in a step places caret exactly there  
Status: `PASS`

Step numbers update live  
Spec: Step numbers must re-render correctly after inserts, deletes, etc.  
Status: `PASS`

---

## INGREDIENTS PARALLEL STRUCTURE

Ingredients hierarchy  
Spec: Ingredients list can optionally use the same two-level model as instructions — headings for groups + ingredient lines.  
Status: `TBD`

Ingredients TAB / SHIFT+TAB (if implemented)  
Spec: Ingredients follow same promotion/demotion rules for consistency.  
Status: `TBD`
