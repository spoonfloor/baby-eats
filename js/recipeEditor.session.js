// --- Inline edit state ---
window.editingStepId = null; // step id currently being edited (string)
window._activeStepInput = null; // live input element (if any)
window._suppressStepCommit = false; // guards blur->commit during cancel flows
window._hasPendingEdit = false; // enables Cancel as soon as typing starts

// --- Session baseline snapshot for Cancel ---
// Captures the original recipe state when a recipe is first rendered or reloaded from DB.
window.originalRecipeSnapshot = null;

// --- Display / selection helpers shared across editor ---

function enableSave() {
  const btn =
    window._recipeEditorSaveBtn || document.getElementById('appBarSaveBtn');
  if (btn) btn.disabled = false;
}

function disableSave() {
  const btn =
    window._recipeEditorSaveBtn || document.getElementById('appBarSaveBtn');
  if (btn) btn.disabled = true;
}

// --- Shared helper: clear any selected instruction line ---
function clearSelectedStep() {
  document
    .querySelectorAll('.instruction-line.selected')
    .forEach((el) => el.classList.remove('selected'));
  // 🧠 Optional: reset global tracking
  window.activeStep = null;
}

function setActiveStep(lineEl) {
  if (!lineEl) return;

  // Logical selection only (no visual highlight here)
  window.activeStep = lineEl;

  if (typeof stepReorderCtx !== 'undefined' && stepReorderCtx) {
    stepReorderCtx.activeStep = lineEl;
  }
}

// --- Cancel / Dirty state tracking ---
let isDirty = false;

// App-bar buttons are injected asynchronously; capture them once available.
window._recipeEditorCancelBtn = null;
window._recipeEditorSaveBtn = null;

function wireRecipeEditorAppBarButtons() {
  window._recipeEditorCancelBtn = document.getElementById('appBarCancelBtn');
  window._recipeEditorSaveBtn = document.getElementById('appBarSaveBtn');

  if (window._recipeEditorCancelBtn)
    window._recipeEditorCancelBtn.disabled = true;
  if (window._recipeEditorSaveBtn) window._recipeEditorSaveBtn.disabled = true;
}

if (typeof waitForAppBarReady === 'function') {
  waitForAppBarReady().then(() => wireRecipeEditorAppBarButtons());
} else {
  wireRecipeEditorAppBarButtons();
}

function recipeEditorGetIsDirty() {
  return !!isDirty;
}

function recipeEditorResetDirty() {
  isDirty = false;
  const c =
    window._recipeEditorCancelBtn || document.getElementById('appBarCancelBtn');
  const s =
    window._recipeEditorSaveBtn || document.getElementById('appBarSaveBtn');
  if (c) c.disabled = true;
  if (s) s.disabled = true;
}

// Expose for main.js so back/cancel/save can share one path.
window.recipeEditorGetIsDirty = recipeEditorGetIsDirty;
window.recipeEditorResetDirty = recipeEditorResetDirty;

function markDirty() {
  if (!isDirty) {
    isDirty = true;

    const c =
      window._recipeEditorCancelBtn ||
      document.getElementById('appBarCancelBtn');
    if (c) c.disabled = false;

    enableSave();
  }
}

function revertChanges() {
  // ✅ Prefer original snapshot for restore; fall back to current recipeData if missing
  const source = window.originalRecipeSnapshot || window.recipeData;
  if (!source) {
    console.warn('⚠️ revertChanges called with no snapshot or recipeData');
    return;
  }

  // Deep clone to avoid mutating the snapshot
  const restoreSource = source?.sections
    ? JSON.parse(JSON.stringify(source))
    : JSON.parse(JSON.stringify(source));

  renderRecipe(restoreSource);

  // Clean up selection and UI state

  // 🔧 Quill v1.1 — fully reset inline-edit globals
  window.editingStepId = null;
  window._activeStepInput = null;
  window._suppressStepCommit = false;
  window._hasPendingEdit = false;

  if (window.getSelection) window.getSelection().removeAllRanges();
  clearSelectedStep();
  recipeEditorResetDirty();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isDirty) {
    revertChanges();
  }
});

async function saveRecipeToDB() {
  const db = window.dbInstance;
  const recipe = window.recipeData;

  if (!db || !recipe) {
    throw new Error('saveRecipeToDB: missing db or recipeData');
  }

  const rid = Number(window.recipeId || recipe.id);
  if (!Number.isFinite(rid)) {
    throw new Error('saveRecipeToDB: invalid recipe id');
  }

  // Transaction keeps steps + ingredients consistent.
  db.run('BEGIN;');
  try {
    // --- 1) Persist recipe metadata (title + servings) ---
  const title = recipe.title || '';

  const servingsDefault =
    recipe.servingsDefault ??
    (recipe.servings && recipe.servings.default != null
      ? recipe.servings.default
      : null);

  const servingsMin =
      recipe.servings && recipe.servings.min != null
        ? recipe.servings.min
        : null;

  const servingsMax =
      recipe.servings && recipe.servings.max != null
        ? recipe.servings.max
        : null;

  db.run(
    'UPDATE recipes SET title = ?, servings_default = ?, servings_min = ?, servings_max = ? WHERE ID = ?;',
    [title, servingsDefault, servingsMin, servingsMax, rid]
  );

  // --- 2) Persist steps from the StepNode model ---
    bridge.saveRecipeStepsFromStepNodes(db, rid, window.stepNodes);

    // --- 3) Persist ingredients from the live model ---
    if (
      window.bridge &&
      typeof bridge.saveRecipeIngredientsFromModel === 'function'
    ) {
      bridge.saveRecipeIngredientsFromModel(db, rid, recipe);
    }

    db.run('COMMIT;');
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch (_) {}
    throw err;
  }

  // Re-read from DB to return a fully refreshed object
  const refreshed = bridge.loadRecipeFromDB(db, rid);

  // Notify any UI helpers (typeahead pools, etc.) that DB-backed suggestion sources may have changed.
  try {
    window.dispatchEvent(new CustomEvent('favoriteEats:db-updated'));
  } catch (_) {}
  try {
    if (typeof window.typeaheadInvalidatePools === 'function') {
      window.typeaheadInvalidatePools();
    }
  } catch (_) {}

  return refreshed;
}
