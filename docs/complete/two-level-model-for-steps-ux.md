MIGRATION PLAN

This is the persistent roadmap for migrating the instruction editor and database
to a simpler, reliable two-level outline model. It is intentionally concise but
complete enough to survive chat resets.

==============================================
TARGET MODEL (END STATE)
==============================================

Instructions are represented as a flat ordered list with fields:
id, type (heading or step), text, and order.

Key rules of the future model:

- Exactly two levels: headings at level 0, steps at level 1.
- Headings are plain list items, not DB sections.
- Steps are numbered automatically from order; numbering is never stored.
- Step numbers are grouped by heading:
  • After each heading, steps restart numbering at 1 (1, 2, 3, …).
  • If the document begins with steps (no heading), that leading run of steps
  forms an implicit first numbering group.
- TAB converts a heading to a step.
- SHIFT+TAB converts a step to a heading.
- No deeper indentation (TAB on step and SHIFT+TAB on heading are no-ops).
- All section tables and section_id fields are removed in the final schema.

==============================================
PHASE 1 — EDITOR FIRST (NO DB CHANGES)
==============================================

Goal: adopt the new two-level conceptual model inside the editor while still
using the old database layout underneath.

1. Introduce unified editor model (StepNode)
   • Internal array containing: id, type, text, order.
   • Becomes the single source of truth during editing.

2. Load adapter (DB → StepNode)
   • Load rows from recipe_steps.
   • Map instructions to text.
   • Map step_number to order.
   • Ignore section_id entirely.
   • Initially treat all lines as steps unless user promotes them to headings.
   • Sort by order and id.

3. Editor uses StepNode exclusively
   • All actions (ENTER, BACKSPACE, merge, split, caret movement) operate on StepNode.
   • BLUR commits to in-memory session state only.
   • ESC reverts to the snapshot taken at edit start.

4. TAB and SHIFT+TAB rules
   • TAB on heading → becomes step.
   • SHIFT+TAB on step → becomes heading.
   • No deeper nesting.
   • Step numbers are derived freshly each render, grouped by heading:
   numbers restart after each heading; any leading run of steps (before the
   first heading) forms its own numbering group.

5. Reordering
   • Reorder modifies order values in StepNode.
   • Caret position stays with the same StepNode id when possible.

6. Save adapter (StepNode → DB)
   • Write each node back to recipe_steps.
   • Use order for step_number.
   • section_id is always written as NULL.
   • recipe_sections and section_contexts untouched.

Phase 1 is complete when the editor behaves consistently under the two-level
grouped-numbering model despite the old DB still being present.

==============================================
PHASE 2 — DATABASE CLEANUP (AFTER EDITOR IS STABLE)
==============================================

Goal: simplify the database so it reflects the StepNode model exactly.

1. Remove legacy section structures
   • Drop recipe_sections.
   • Drop section_contexts.
   • Remove section_id from recipe_steps and recipe_ingredient_map if
   ingredients no longer need sections.

2. Add type column to recipe_steps
   • New column: type = heading | step.
   • Default: step.
   • Optionally infer headings from prior editor state.

3. Normalize ordering field
   • Either rename step_number → order
   OR keep step_number but reinterpret purely as ordering.
   • Derived display numbers (grouped by heading) are always computed in UI.

4. Simplify load/save adapters
   • With type and order present, DB ↔ StepNode is 1:1.
   • No special section logic needed.

5. Optional: mirror two-level model in ingredients
   • Apply same structure: heading rows + ingredient rows.
   • Consistent TAB/SHIFT+TAB behavior.

==============================================
GUIDING PRINCIPLES
==============================================

- Editor behavior first, DB schema second.
- All transformations should be small, testable, reversible.
- StepNode is always the mental model.
- Blank lines are real nodes and persist across BLUR/SAVE unless removed by DELETE or ESC.
- Display numbers (grouped per heading) are never stored in DB; always derived.

==============================================
MIGRATION STATUS
==============================================

PHASE 1 — EDITOR FIRST (no DB changes)

[x] 1. Unified StepNode model created

[x] 2. Load adapter (DB → StepNode) implemented
We still need to clean up the legacy section/step merging logic so we only load
the steps from the active section, or from all sections but without duplicates —
depending on the future architecture.

[x] 3. Editor reads/writes exclusively through StepNode

- [x] 3a. Editor reads exclusively from StepNode (render path)

- [x] 3b. Editor writes exclusively through StepNode (edit + session path)

  - [x] Plain text edits (BLUR inline) update StepNode as the primary model.
  - [x] Structural edits: ENTER split mirrored into StepNode.
  - [x] Structural edits: BACKSPACE merge mirrored into StepNode.
  - [x] ENTER (start-of-line) fully StepNode-driven; caret returns to content line.
  - [x] Structural edits fully StepNode-driven (blank create/delete,
        ESC healing, BLUR/SAVE session logic, reordering) with
        legacy model updated only for backward compatibility.

+[x] 4. Add type column to recipe_steps (type TEXT NOT NULL DEFAULT 'step')

[x] 5. Reordering updates StepNode order consistently

[x] 6. Save adapter (StepNode → DB) implemented

Phase 1 completion milestone:
[x] Editor fully matches the target two-level model and is stable

---

PHASE 2 — DATABASE CLEANUP

[x] 1. Drop recipe_sections
[x] 2. Drop section_contexts
[x] 3. Remove section_id from: - recipe_steps - recipe_ingredient_map
[x] 4. Normalize ordering (rename step_number → order, or clearly
document that step_number is “pure ordering only”)
[x] 5. Simplify adapters to 1:1 mapping (DB ↔ StepNode)
