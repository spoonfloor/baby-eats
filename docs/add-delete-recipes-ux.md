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
- [ ] Label = “Add”
- [ ] Click → opens title dialog
- [ ] After creation, sorting obeys alphabetical order

---

### 2. Title dialog

- [ ] Dialog contains single **Title** field
- [ ] Buttons: **Cancel** (left), **Create** (right)
- [ ] **Create disabled** until title has text
- [ ] Cancel → close dialog, do nothing, no toast
- [ ] Create → insert new recipe with:
  - [ ] Required title
  - [ ] servings_default = null
  - [ ] servings_min = null
  - [ ] servings_max = null
  - [ ] exactly **one** blank ingredient row
  - [ ] exactly **one** blank instruction step
- [ ] Dialog does **not** retain text after cancel
- [ ] No animation

---

### 3. Editor initial layout (new recipe)

- [ ] Start editor scrolled to top
- [ ] Title shown and editable
- [ ] Servings row immediately visible in edit mode
- [ ] Caret placed in default servings field
- [ ] INGREDIENTS section shown
- [ ] First ingredient row = blank placeholder “Add an ingredient”
- [ ] YOU WILL NEED card shown (title only)
- [ ] INSTRUCTIONS section shown
- [ ] First step = placeholder “Add a step”

---

### 4. Title behavior

- [ ] Clicking Title always enters title edit mode
- [ ] Clicking Title always reveals Servings row (if hidden)
- [ ] Title remains editable after creation

---

### 5. Servings row behavior

**Entering edit mode:**

- [ ] If default is null → show only (default)[ ]
- [ ] If default is non-null → show (default)[v] (min)[ ] (max)[ ]
- [ ] Min/max always shown in edit mode when default exists
- [ ] Clicking any pill focuses associated field
- [ ] Clicking “Servings: X” → focuses default field + selects entire value

**Tab / Shift-Tab:**

- [ ] Tab order = default → min → max → next-row-first-field
- [ ] Shift-Tab = reverse

**Blur: parsing & validation:**

- [ ] Parse default first
- [ ] If default invalid → clear all three & hide subtitle
- [ ] If default valid → parse min & max
- [ ] If min/max invalid → clear those only
- [ ] All numeric values rounded to integer
- [ ] Rest mode displays **“Servings: X”** only
- [ ] Min/max never shown in rest mode
- [ ] Min/max allowed only when default is present

---

### 6. Ingredient rows (text model for now)

**Enter insertion:**

- [ ] Enter at start of row → insert blank row above, focus Qty
- [ ] Enter mid/end of row → insert blank row below, focus Qty

**Use-it-or-lose-it cleanup:**

- [ ] Blank inserted row disappears on blur if still blank
- [ ] Except when it is the **only** ingredient row (placeholder case)

**Delete behavior:**

- [ ] Backspace at start of non-blank row = no-op
- [ ] Backspace at end = normal text deletion
- [ ] Backspace on blank row at start → deletes row unless it’s the only row

**Tab behavior (future pill model ready):**

- [ ] Tab moves to next field: Qty → Unit → Name → Variant → Parenthetical → Prep
- [ ] Shift-Tab reverses
- [ ] At last field, Tab → first field of next row
- [ ] If field has content, Tab selects all; if empty, caret at start
- [ ] Deleting Qty returns caret to Qty, does not auto-advance

**Entry when list empty:**

- [ ] Enter on lone blank row = blur (no new row)

---

### 7. Instructions (existing working model)

- [ ] Placeholder appears only when list empty
- [ ] Enter behaves according to existing step editor rules
- [ ] Blank steps persist until explicitly deleted
- [ ] No changes required for this feature

---

### 8. Delete recipe (recipes list)

Trigger:

- [ ] Ctrl-click on a recipe row opens delete dialog
- [ ] Normal click still opens recipe editor

Dialog:

- [ ] Confirm text: “Delete ‘TITLE’?”
- [ ] Buttons: Cancel (left), Delete (right)
- [ ] Cancel → close dialog, nothing else
- [ ] Delete → remove recipe from DB + list
- [ ] No row selection maintained (list has hover only)

Toast:

- [ ] Bottom-center neutral toast: “TITLE was deleted. Undo”
- [ ] Undo restores recipe (single-level destructive undo)
- [ ] If multiple deletes occur, only most recent is undoable

---

### 9. Navigation & scrolling

- [ ] After creation, editor always scrolls to top
- [ ] After delete, no reselection occurs
- [ ] No special animations required

---

### 10. Miscellaneous invariants

- [ ] Title required to create recipe
- [ ] Duplicate titles permitted (for now)
- [ ] Min/max never legal without default
- [ ] Only one blank ingredient row allowed at end (others auto-clean)
- [ ] Ingredient insertions create temporary blanks which vanish unless used

---

This is the complete, implementation-ready spec with checkboxes.  
Say **“synced”** once you drop it into your project docs.

---

## FUTURE COMPATIBILITY NOTES (for bulk paste support)

- Ingredient rows are **atomic**: one ingredient per row.  
  Bulk paste should explode multi-line text into multiple ingredient rows.

- Maintain stable field order: qty → unit → name → variant → parenthetical → prep.  
  Parsers will map tokens into these fields.

- Blank ingredient rows remain **temporary** unless edited (“use it or lose it”).  
  Prevents bulk paste from generating piles of empty rows.

- Blank rows must not carry special state.  
  Ensures paste handling remains simple and deterministic.

- Step editor already supports text-editor semantics; bulk paste can rely on existing  
  split/merge/insert logic without special cases.

- Servings row should **never** interpret pasted text.  
  Only becomes editable via Title or Servings click.

- Insertion semantics must remain stable:  
  Enter inserts above/below; paste targets current caret row and may create many rows.  
  Predictable behavior simplifies parsing.

- Avoid assumptions that paste affects only one row.  
  Users may paste multi-line content into selections spanning multiple rows.
