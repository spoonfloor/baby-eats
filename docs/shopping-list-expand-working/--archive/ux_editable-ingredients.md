# Inline Row Editing: Servings + Ingredients

## Goal

Reuse the servings inline-edit pattern for ingredients so fixes/UX polish apply to both.

## Scope (v1)

- [ ] Keep existing servings behavior; just refactor.
- [x] Add “Add an ingredient” → full pill/field row.
- [x] No subrecipe “link” yet.

## Field Map (ingredients)

Display label → schema key:

- [x] qty → quantity
- [x] unit → unit
- [x] name → name
- [x] var → variant
- [x] prep → prepNotes
- [x] notes → parentheticalNote
- [x] opt → isOptional (toggle)
- [x] loc → locationAtHome (dropdown)
- [x] link → subRecipeId (skipped in v1)

## Shared Concepts

- [x] Inline row “edit mode” (one row at a time).
- [x] Placeholder rows (“Add an ingredient.”).
- [x] Use-it-or-lose-it: empty edits revert to placeholder.
- [x] Blur guard: only commit/cancel when focus leaves the row.
- [x] Label → input click wiring (pills).

## New Helpers (utils.js)

- [x] `setupInlineRowEditing(options)`

  - options:
    - rowElement
    - isEmpty()
    - commit()
    - cancel()
    - getIsEditing()
    - setIsEditing(bool)
  - Handles:
    - Enter/Escape
    - click-to-enter
    - blur guard (via focusout)

- [x] `wireLabelToInput(labelEl, inputEl)`
  - Shared by servings and ingredients.

## Servings (Refactor Only)

- [ ] Replace ad-hoc logic in `renderServingsRow` with:
  - global or module-level flag: `isServingsEditing`.
  - `setupInlineRowEditing`:
    - isEmpty: all servings inputs blank/invalid.
    - commit: normalize + write to recipe model.
    - cancel: restore from model.
- [ ] No UX changes intended.

## Ingredients: UX

- Initial:

  - [x] Ingredient list (read-only lines) plus one placeholder line:
    - “Add an ingredient.” tagged `isPlaceholder: true`.

- Enter edit:

  - [x] Click placeholder row:
    - Replace that line with editable ingredient row.
    - Show pills/inputs: qty, unit, name, var, prep, notes, opt, loc.
    - Focus qty.

- Commit vs cancel:

  - [x] On blur:
    - If focus stays inside row: do nothing.
    - Else:
      - If all fields empty: cancel
        - Remove temp ingredient.
        - Restore single “Add an ingredient.” placeholder row.
      - Else: commit
        - Build ingredient object, push into `section.ingredients`.
        - Re-render as read-only text line.
        - Ensure new placeholder row exists at bottom.

- Keyboard:
  - [x] Enter:
    - If current row has any data:
      - commit row if valid enough (TBD simple rule: quantity or name non-empty).
      - create new edit row below, focus qty.
  - [x] Escape:
    - If new row and empty: same as cancel.
    - If existing row (later v2): revert changes.

## Ingredients: Rendering

- [x] `renderIngredientRow(ingredient, index, sectionId)`

  - Read-only line (current behavior, maybe slightly adjusted).
  - If `ingredient.isPlaceholder`: special styling “Add an ingredient.”, click opens editor.

- [ ] `renderIngredientEditRow(ingredientDraft, index, sectionId)`
  - Builds DOM row with pills + inputs.
  - Calls `setupInlineRowEditing` with:
    - isEmpty: all ingredient fields blank.
    - commit: writes to `section.ingredients`, clears draft.
    - cancel: restores placeholder or original.

## Data Model Notes

- [x] New temp ingredient:
  - Not saved to recipe until commit.
  - May live in local JS state (e.g. transient object, not yet in ingredients array).
- [x] Placeholder:
  - Either:
    - Real ingredient object with `isPlaceholder: true`, or
    - Special synthetic row not stored in DB, only in view layer.
  - Choose minimal change: reuse existing placeholder pattern if present.

## Edge Cases

- [x] User types only spaces:
  - Treat as empty.
- [x] User deletes all fields then blurs:
  - Row removed → placeholder restored.
- [ ] Multiple sections:
  - Each section manages its own placeholder row and edit state.
- [x] Single active editor:
  - If a second row tries to enter edit:
    - Either block or implicitly commit/cancel first; v1 can block by ignoring clicks while `isEditing == true`.

## Implementation Steps

- [x] 1. utils: add `setupInlineRowEditing` and `wireLabelToInput`.
- [ ] 2. Servings:
  - [ ] Refactor `renderServingsRow` to use helpers.
  - [ ] Confirm no behavior changes (existing tests).
- [x] 3. Ingredients:
  - [x] Implement `renderIngredientEditRow` using helpers.
  - [x] Wire placeholder “Add an ingredient.” row to open editor.
  - [x] Implement commit/cancel + placeholder regeneration.
- [x] 4. Wire keyboard handling (Enter, Escape) per UX above.
- [ ] 5. Light styling for pills/fields so they align visually with servings row.

## Testing (super terse)

- [ ] Servings:
  - [ ] Edit default/min/max as before; verify no regressions (focus, blur, hiding).
- [ ] Ingredients:
  - [ ] Click “Add an ingredient.” → editor shows, qty focused.
  - [ ] Blur with everything empty → back to placeholder.
  - [ ] Fill fields, blur → committed line, new placeholder at bottom.
  - [ ] Enter on filled row → commits + new blank row.
