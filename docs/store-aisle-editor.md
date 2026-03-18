# Continuity: Store editor — Aisle cards

Handoff for a new agent. Build in **small chunks**, verify after each, then continue.

---

## Canonical data model (actual DB)

Do **not** trust the checked-in `favorite_eats.db.sql` as schema truth; the user’s DB lives elsewhere.

| Concept                  | Table                       | Notes                                                                   |
| ------------------------ | --------------------------- | ----------------------------------------------------------------------- |
| Store (chain + location) | `stores`                    | `chain_name`, `location_name`                                           |
| Aisle                    | `store_locations`           | `store_id` → `stores.ID`, `name`, optional `aisle_number`, `sort_order` |
| Item on an aisle         | `ingredient_store_location` | `ingredient_id`, `store_location_id` → `store_locations.ID`             |

There is **no** `store_aisles` table. `docs/store-db-info.md` describes a different shape; **the user asked not to refresh that doc**—treat it as non-authoritative for implementation.

---

## Feature behavior (agreed)

**Page anatomy**

- Editable **store name** (title) and **location** (subtitle) — same pattern as **unit editor**.
- **Card layout** — same system as **shopping item editor** cards.
- Section header **“Aisles”** — same visual/format as **“Pluralization overrides (optional)”** on shopping item editor.
- Column of **one card per aisle**; each card: **aisle name** + **item list**.

**Empty aisles**

- If no aisles: hint **“Add an aisle”** — same idea as **“Add an ingredient”** (recipe editor).
- Click → **“New Aisle”** dialog — same flow as **Stores → Add → New Store**.
- On **Create**: new card; aisle name is title styled like **purple in-card headings** (e.g. **“Variants”**) on shopping item editor; name is **editable** (established pattern).

**Item list (per aisle)**

- Same **pattern/behavior** as lists on shopping item editor.
- Empty list: hint **“Add an item.”**
- Focusing the list: **shopping item suggestions** like **Home location** on shopping item editor.
- List is a **paste target** (same as shopping item editor).
- On **commit**: strings that don’t match existing DB shopping items → **new ingredient confirmation**; **Confirm** creates ingredients in DB; **Cancel** returns to editing the list; **Discard** closes dialog, drops changes, exits edit mode.
- **Dedupe** on commit: same shopping item must not appear twice on one aisle.

**Multiple aisles / “add below active”**

- When **≥1** card and user is in **edit mode** on a card, show **“Add an aisle”** **below that active card**.
- Clicking that hint **blurs** the active card.
- If the active card has **no** pending new ingredients → open **New Aisle** dialog; on commit, new card at hint position.
- If there **are** pending new ingredients → run **new ingredient confirmation first**, **then** open **New Aisle** dialog.

**Delete aisle**

- **Ctrl+click** on **blank / non-interactive** card surface only (**not** editable title, **not** item list) → confirm dialog (established pattern) → **permanent** delete from DB (aisle row + related mappings as appropriate).

**Later (not this pass)**

- Drag-to-reorder aisles and/or items within an aisle.

---

## User preferences / negatives

- **Do not** update `docs/store-db-info.md` to match schema (explicit request).
- **Do not** assume checked-in SQL dump is canonical.
- Prefer **incremental** delivery: ship a slice, **test**, then next slice.

---

## Codebase pointers (verify paths when implementing)

- Store editor: `loadStoreEditorPage` and related in `js/main.js`.
- Patterns to mirror: unit editor (title/subtitle), shopping item editor (cards, lists, Home location, paste, new ingredient confirm), recipe editor (“Add an ingredient”), Stores page (New Store dialog).
- Existing deletes may reference `ingredient_store_location` / `store_location_id` — align with real schema.

---

## Open implementation detail

- **Chunk 1:** Listing/updating/inserting `store_locations` is done inline in `loadStoreEditorPage` via SQL.js (`openStoreEditorDb` / `persistStoreEditorDb`), same stack as store list/delete.
- Still to wire: **`ingredient_store_location`** CRUD per aisle; reuse shopping-item list + new-ingredient patterns from `loadShoppingItemEditorPage` / related.

## Completed work

- **Store title + description subtitle:** Editable store title and a subtitle bound to `stores.location_name`. Subtitle uses `wireChildEditorPage` with `subtitleEmptyMeansHidden: true` so it is **hidden when empty** and **only appears while the title is in edit mode**; placeholder is **“Add a description.”**. If a description is entered it persists on blur; if left empty it hides again after title edit ends.
- **Aisles section** (only when the store row exists — valid `selectedStoreId`): header **Aisles** (pluralization-overrides-style label).
- **Empty state:** **Add an aisle** (`placeholder-prompt`; click + Enter/Space). **New Aisle** dialog (`window.ui.prompt`, same shape as New Store: Create/Cancel) → `INSERT store_locations (store_id, name, sort_order)` with `sort_order = MAX+1` → persist DB → new card. With **1+** aisles, that hint is **hidden** until focus enters an aisle card (name or items field); it sits **below the focused card** and **hides on blur** when focus leaves cards + CTA.
- **Cards:** One card per aisle; aisle **name** uses purple in-card label styling; **click to edit**, **Enter** or blur commits `UPDATE store_locations SET name`; **Esc** cancels; saves immediately (not tied to app-bar Save).
- **First save without row ID:** After `INSERT stores`, page **reloads** so **Aisles** appears once `selectedStoreId` exists.
- **Aisle item list editor:** Each aisle card contains a single shopping-editor-style newline textarea (placeholder **“Add an item.”**), open-on-tap, with blur commit behavior via `commitAisleItemEdit` (unknown-item confirmation flow preserved) and **Esc restoring last committed** content; no extra Cancel/Commit buttons or nested editor chrome.
- **CSS parity:** Store aisle item list uses the same `.shopping-item-field` / `.shopping-item-textarea` visuals + focus chrome as shopping lists (so it sits inside the list surface).
