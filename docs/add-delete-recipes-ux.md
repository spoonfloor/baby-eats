# Add & Delete Recipe — UX Spec

Implementation checklist with checkboxes

---

## OVERVIEW

Creating a new recipe flows through:

1. Tap **Add**
2. **Title dialog** (required)
3. Editor opens with:
   - Title
   - Servings row (default field focused)
   - Ingredients section (one placeholder row)
   - You Will Need (empty card, always shown)
   - Instructions section (one placeholder step)
4. Ingredient + instruction editing uses “use it or lose it” semantics
5. Ctrl-click a recipe row → delete dialog → delete → toast with Undo

---

## CHECKLIST

### 1. Add button (recipes.html)

- [x] Add button visible in recipe list
- [x] Label = “Add”
- [x] Click → opens title dialog
- [x] After creation, sorting obeys alphabetical order

---

### 2. Title dialog

- [x] Dialog contains single **Title** field
- [x] Buttons: **Cancel** (left), **Create** (right)
- [x] **Create disabled** until title has text
- [x] Cancel → close dialog, do nothing, no toast
- [x] Create → insert new recipe with:
  - [x] Required title
  - [x] servings_default = null
  - [x] servings_min = null
  - [x] servings_max = null
  - [ ] exactly **one** blank ingredient row (future)
  - [ ] exactly **one** blank instruction step (future)
- [x] Dialog does **not** retain text after cancel
- [x] No animation

---

### 3. Editor initial layout (new recipe)

(Current editor is not yet generating the auto-rows below.)

- [x] Start editor scrolled to top
- [x] Title shown and editable
- [ ] Servings row immediately visible in edit mode
- [ ] Caret placed in default servings field
- [ ] INGREDIENTS section shown
- [ ] First ingredient row = blank placeholder “Add an ingredient”
- [ ] YOU WILL NEED card shown (title only)
- [ ] INSTRUCTIONS section shown
- [ ] First step = placeholder “Add a step”

---

### 4. Title behavior

- [x] Clicking Title enters title edit mode
- [ ] Clicking Title reveals Servings row (if hidden)
- [x] Title remains editable after creation

---

### 5. Servings row behavior

Entering edit mode:

- [ ] If default is null → show only (default)[ ]
- [ ] If default is non-null → show (default)[v] (min)[ ] (max)[ ]
- [ ] Min/max always shown in edit mode when default exists
- [ ] Clicking any pill focuses associated field
- [ ] Clicking “Servings: X” → focuses default field and selects entire value

Tab / Shift-Tab:

- [ ] Tab order = default → min → max → next-row-first-field
- [ ] Shift-Tab = reverse

Blur: parsing & validation:

- [ ] Parse default first
- [ ] If default invalid → clear all 3 and hide subtitle
- [ ] If default valid → parse min and max
- [ ] If min/max invalid → clear those only
- [ ] Round numeric values
- [ ] Rest mode: “Servings: X”
- [ ] Min/max never shown in rest mode
- [ ] Min/max allowed only when default is present

---

### 6. Ingredient rows (text model for now)

Enter insertion:

- [ ] Enter at start → insert blank row above, focus Qty
- [ ] Enter mid/end → insert blank row below, focus Qty

Use-it-or-lose-it:

- [ ] Blank inserted row disappears on blur if still blank
- [ ] Except when only ingredient row (placeholder)

Delete behavior:

- [ ] Backspace at start of non-blank row = no-op
- [ ] Backspace at end = normal deletion
- [ ] Backspace on blank row at start → delete unless only row

Tab behavior (future pill model):

- [ ] Qty → Unit → Name → Variant → Parenthetical → Prep
- [ ] Shift-Tab reverses
- [ ] Last field Tab → first field of next row
- [ ] Tab selects-all if field has content
- [ ] Removing Qty snaps caret back to Qty

Entry when list empty:

- [ ] Enter on lone blank row = blur

---

### 7. Instructions (existing working model)

- [x] Placeholder appears only when list empty
- [x] Enter behavior correct
- [x] Blank steps persist until explicitly deleted
- [x] No changes required for this feature

---

### 8. Delete recipe (recipes list)

Trigger:

- [ ] Ctrl-click on recipe row opens delete dialog
- [x] Normal click opens recipe editor

Dialog:

- [ ] Confirm text: “Delete ‘TITLE’?”
- [ ] Buttons: Cancel (left), Delete (right)
- [ ] Cancel → no-op
- [ ] Delete → remove from DB + list
- [ ] No row selection persists

Toast:

- [ ] Toast: “TITLE was deleted. Undo”
- [ ] Undo restores recipe
- [ ] Only most recent delete is undoable

---

### 9. Navigation & scrolling

- [ ] After creation, editor scrolls to top
- [ ] After delete, no reselection
- [x] No special animations required

---

### 10. Miscellaneous invariants

- [x] Title required to create recipe
- [x] Duplicate titles permitted
- [ ] Min/max never legal without default
- [ ] Only one blank ingredient row allowed at end
- [ ] Temporary blanks vanish unless edited

---

This is the complete, implementation-ready spec with checkboxes.  
Say **“synced”** once you drop it into your project docs.

---

## FUTURE COMPATIBILITY NOTES (for bulk paste support)

- Ingredient rows are atomic; bulk paste → multiple rows.
- Field order stable: qty → unit → name → variant → parenthetical → prep.
- Blank ingredient rows temporary unless edited.
- No special blank-row state.
- Step editor already supports full text semantics.
- Servings row never parses pasted text.
- Insert behavior consistent (above/below).
- Multi-line paste allowed; affects many rows predictably.
